package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	notify "github.com/Wikid82/go_notify_yourself"
	webpush "github.com/Wikid82/go_notify_yourself/providers/webpush"
	"github.com/Wikid82/go_notify_yourself/transport"

	"hestia/backend/internal/models"
)

// ErrBaseURLNotConfigured is returned wherever Web Push needs a VAPID
// subject and BASE_URL isn't set — see PushService's doc comment.
var ErrBaseURLNotConfigured = errors.New("web push is not available: BASE_URL is not configured")

// ErrInvalidSubscription is returned by Subscribe when the browser-
// supplied subscription is missing a required field.
var ErrInvalidSubscription = errors.New("endpoint, p256dh, and auth are all required")

// PushService sends per-user Web Push notifications (issue #39) — a
// different concern from NotifyService's singleton, instance-wide,
// system-admin-facing alert channel. Each household member who opts in
// gets their own browser PushSubscription row(s); PushService fans a
// message out to every subscription a user has, via
// go_notify_yourself's "webpush" provider (direct RFC 8030/8291/8292
// delivery, no third-party relay).
type PushService struct {
	db      *gorm.DB
	wrapper *transport.Wrapper
	// baseURL mirrors config.Config.BaseURL — used to derive the RFC 8292
	// VAPID JWT "sub" claim. See vapidSubject.
	baseURL string
}

func NewPushService(db *gorm.DB, baseURL string) *PushService {
	return &PushService{db: db, wrapper: transport.NewWrapper(), baseURL: baseURL}
}

// vapidSubject derives the RFC 8292 VAPID JWT "sub" claim from baseURL:
// "https://" plus baseURL's host, regardless of baseURL's own scheme — a
// self-hoster running plain HTTP behind no TLS still needs a spec-legal
// "https:" or "mailto:" subject (see webpush.Config.VAPIDSubject). Returns
// ErrBaseURLNotConfigured if baseURL is unset, rather than falling back to
// a placeholder — same "don't paper over missing config" instinct as
// Mailer.IsConfigured().
func (s *PushService) vapidSubject() (string, error) {
	if strings.TrimSpace(s.baseURL) == "" {
		return "", ErrBaseURLNotConfigured
	}
	parsed, err := url.Parse(s.baseURL)
	if err != nil || parsed.Host == "" {
		return "", fmt.Errorf("BASE_URL is not a valid URL")
	}
	return "https://" + parsed.Host, nil
}

// getOrCreateConfig returns the instance's VAPID keypair, generating and
// persisting one on first use. A create race (two concurrent first-callers)
// is resolved by re-reading rather than erroring — the "generate once"
// guarantee only cares that exactly one keypair wins, not which caller
// created it.
func (s *PushService) getOrCreateConfig() (*models.PushConfig, error) {
	var cfg models.PushConfig
	err := s.db.Where("id = ?", models.PushConfigID).First(&cfg).Error
	if err == nil {
		return &cfg, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	pub, priv, err := webpush.GenerateVAPIDKeyPair()
	if err != nil {
		return nil, fmt.Errorf("generating VAPID keypair: %w", err)
	}
	cfg = models.PushConfig{ID: models.PushConfigID, VAPIDPublicKey: pub, VAPIDPrivateKey: priv}
	if err := s.db.Create(&cfg).Error; err != nil {
		var existing models.PushConfig
		if reErr := s.db.Where("id = ?", models.PushConfigID).First(&existing).Error; reErr == nil {
			return &existing, nil
		}
		return nil, err
	}
	return &cfg, nil
}

// VAPIDPublicKey returns the instance's VAPID public key for the frontend
// to pass as PushManager.subscribe's applicationServerKey, generating the
// keypair on first use. Fails fast on ErrBaseURLNotConfigured rather than
// handing out a key the instance can never actually send with.
func (s *PushService) VAPIDPublicKey() (string, error) {
	if _, err := s.vapidSubject(); err != nil {
		return "", err
	}
	cfg, err := s.getOrCreateConfig()
	if err != nil {
		return "", err
	}
	return cfg.VAPIDPublicKey, nil
}

// SubscriptionInput is one browser's PushSubscription, as delivered by
// PushSubscription.toJSON() in the browser.
type SubscriptionInput struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// Subscribe upserts a PushSubscription for userID: a re-subscription of
// the same endpoint (e.g. the browser refreshed its subscription) replaces
// the stored keys rather than creating a duplicate row.
func (s *PushService) Subscribe(userID string, in SubscriptionInput) error {
	endpoint := strings.TrimSpace(in.Endpoint)
	p256dh := strings.TrimSpace(in.P256dh)
	auth := strings.TrimSpace(in.Auth)
	if endpoint == "" || p256dh == "" || auth == "" {
		return ErrInvalidSubscription
	}

	var existing models.PushSubscription
	err := s.db.Where("user_id = ? AND endpoint = ?", userID, endpoint).First(&existing).Error
	switch {
	case err == nil:
		existing.P256dh = p256dh
		existing.Auth = auth
		return s.db.Save(&existing).Error
	case errors.Is(err, gorm.ErrRecordNotFound):
		return s.db.Create(&models.PushSubscription{
			ID:       uuid.NewString(),
			UserID:   userID,
			Endpoint: endpoint,
			P256dh:   p256dh,
			Auth:     auth,
		}).Error
	default:
		return err
	}
}

// Unsubscribe deletes userID's PushSubscription for endpoint, if any.
// Idempotent: a not-found endpoint is a no-op, not an error.
func (s *PushService) Unsubscribe(userID, endpoint string) error {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil
	}
	return s.db.Where("user_id = ? AND endpoint = ?", userID, endpoint).Delete(&models.PushSubscription{}).Error
}

// PushMessage is one notification to fan out to every subscription a user
// has.
type PushMessage struct {
	Title string
	Body  string
	Data  map[string]any
}

// SendToUser sends msg to every PushSubscription userID has, pruning any
// subscription the push service reports as permanently gone (404/410 —
// per the Web Push spec, that means uninstalled, revoked, or cleared
// browser data) instead of retrying it forever. A no-op if the user has no
// subscriptions — matches NotifyService.Notify's "optional side-channel,
// not configured is a valid state" posture, since callers (e.g. a chore
// assignment) shouldn't fail their own request just because the assignee
// hasn't opted into push. Errors from subscriptions that aren't gone are
// joined and returned so callers can log them; still best-effort from the
// caller's point of view.
func (s *PushService) SendToUser(ctx context.Context, userID string, msg PushMessage) error {
	var subs []models.PushSubscription
	if err := s.db.Where("user_id = ?", userID).Find(&subs).Error; err != nil {
		return err
	}
	if len(subs) == 0 {
		return nil
	}

	cfg, err := s.getOrCreateConfig()
	if err != nil {
		return err
	}
	subject, err := s.vapidSubject()
	if err != nil {
		return err
	}

	var sendErrs []error
	for _, sub := range subs {
		client := webpush.New(webpush.Config{
			VAPIDPublicKey:  cfg.VAPIDPublicKey,
			VAPIDPrivateKey: cfg.VAPIDPrivateKey,
			VAPIDSubject:    subject,
			Endpoint:        sub.Endpoint,
			P256dh:          sub.P256dh,
			Auth:            sub.Auth,
		}, s.wrapper)

		sendErr := client.Send(ctx, notify.Message{Title: msg.Title, Body: msg.Body, Data: msg.Data})
		if sendErr == nil {
			continue
		}
		if isGoneStatus(sendErr) {
			_ = s.db.Delete(&models.PushSubscription{}, "id = ?", sub.ID).Error
			continue
		}
		sendErrs = append(sendErrs, fmt.Errorf("subscription %s: %w", sub.ID, sendErr))
	}

	return errors.Join(sendErrs...)
}

// isGoneStatus reports whether err is transport.Wrapper.Send's error for a
// 404 or 410 response. The Sender interface (webpush.Client.Send included)
// only returns an error, not the underlying transport.Result, so this
// matches transport's own fixed "provider returned status %d[: hint]"
// format instead — safe because an HTTP status code is always exactly 3
// digits, so "status 404"/"status 410" can't false-match a different code.
func isGoneStatus(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "status 404") || strings.Contains(msg, "status 410")
}
