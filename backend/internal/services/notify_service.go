package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	notify "github.com/Wikid82/go_notify_yourself"
	_ "github.com/Wikid82/go_notify_yourself/providers/discord"
	_ "github.com/Wikid82/go_notify_yourself/providers/gotify"
	_ "github.com/Wikid82/go_notify_yourself/providers/ntfy"
	_ "github.com/Wikid82/go_notify_yourself/providers/pushover"
	_ "github.com/Wikid82/go_notify_yourself/providers/slack"
	_ "github.com/Wikid82/go_notify_yourself/providers/telegram"
	_ "github.com/Wikid82/go_notify_yourself/providers/webhook"
	"github.com/Wikid82/go_notify_yourself/transport"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

// providerRequiredFields lists each provider's required config keys, per
// that provider package's register.go doc comment. The provider
// constructors themselves don't enforce this (they only require
// "transport", defaulting missing string fields to "" and failing later,
// at Send time) — checked here instead so a bad/incomplete config is
// rejected on save, not silently accepted until the first real
// notification attempt.
var providerRequiredFields = map[string][]string{
	"discord":  {"webhook_url"},
	"slack":    {"webhook_url"},
	"gotify":   {"url"},
	"ntfy":     {"url"},
	"pushover": {"user_key", "api_token"},
	"telegram": {"bot_token", "chat_id"},
	"webhook":  {"url"},
}

// ErrNotificationsNotConfigured is returned by SendTest (only) when no
// notification channel is configured yet — Notify itself no-ops silently
// in that case, since most callers (invite-accepted, etc.) shouldn't fail
// their own operation just because notifications aren't set up.
var ErrNotificationsNotConfigured = errors.New("no notification channel is configured")

// NotifyService sends admin-facing notifications (e.g. "an invite was
// accepted") through whichever go_notify_yourself provider the system
// admin has configured. Deliberately limited to the seven HTTP-webhook-
// style providers (Discord, Slack, Gotify, Pushover, ntfy, Telegram,
// generic webhook) rather than also wiring the module's "email" provider:
// that provider expects an HTML-capable Mailer, and services.Mailer (see
// mailer.go) is plain-text only — self-hosters already running one of the
// above for home-lab alerting is the more natural fit for "someone
// accepted my invite" pings. Outbound invite email itself (a different
// concern) goes straight through services.Mailer, not through this.
type NotifyService struct {
	db      *gorm.DB
	wrapper *transport.Wrapper
}

func NewNotifyService(db *gorm.DB) *NotifyService {
	return &NotifyService{db: db, wrapper: transport.NewWrapper()}
}

// GetSettings returns the current notification settings, or an empty
// (Provider: "") row if none have been saved yet — that's a valid,
// unconfigured state, not an error.
func (s *NotifyService) GetSettings() (*models.NotificationSettings, error) {
	var settings models.NotificationSettings
	err := s.db.Where("id = ?", models.NotificationSettingsID).First(&settings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &models.NotificationSettings{ID: models.NotificationSettingsID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

// UpdateSettings validates provider against the compiled-in provider list
// and, if config is enough to actually construct a Sender, does so before
// saving — a bad webhook URL or missing token should fail here, not
// silently at the next notification attempt. Provider "" clears the
// configured channel.
func (s *NotifyService) UpdateSettings(provider string, config map[string]any) (*models.NotificationSettings, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))

	if provider != "" {
		required, ok := providerRequiredFields[provider]
		if !ok {
			return nil, fmt.Errorf("unknown notification provider %q", provider)
		}
		for _, key := range required {
			if v, ok := config[key].(string); !ok || strings.TrimSpace(v) == "" {
				return nil, fmt.Errorf("%s requires a non-empty %q", provider, key)
			}
		}
		if _, err := s.newSender(provider, config); err != nil {
			return nil, fmt.Errorf("invalid configuration for %s: %w", provider, err)
		}
	}

	configJSON := ""
	if len(config) > 0 {
		b, err := json.Marshal(config)
		if err != nil {
			return nil, err
		}
		configJSON = string(b)
	}

	settings := models.NotificationSettings{
		ID:         models.NotificationSettingsID,
		Provider:   provider,
		ConfigJSON: configJSON,
	}
	if err := s.db.Save(&settings).Error; err != nil {
		return nil, err
	}
	return &settings, nil
}

// newSender builds a notify.Sender for provider/config, injecting the
// shared transport.Wrapper every HTTP-based provider expects.
func (s *NotifyService) newSender(provider string, config map[string]any) (notify.Sender, error) {
	cfg := make(map[string]any, len(config)+1)
	for k, v := range config {
		cfg[k] = v
	}
	cfg["transport"] = s.wrapper
	return notify.New(provider, cfg)
}

// currentSender builds a Sender from whatever's currently saved, or
// returns (nil, nil) if notifications aren't configured — a valid,
// silently-skippable state for Notify.
func (s *NotifyService) currentSender() (notify.Sender, error) {
	settings, err := s.GetSettings()
	if err != nil {
		return nil, err
	}
	if settings.Provider == "" {
		return nil, nil
	}
	var config map[string]any
	if settings.ConfigJSON != "" {
		if err := json.Unmarshal([]byte(settings.ConfigJSON), &config); err != nil {
			return nil, fmt.Errorf("stored notification config is corrupt: %w", err)
		}
	}
	return s.newSender(settings.Provider, config)
}

// Notify sends an admin-facing event through the configured channel. A
// no-op (nil error) if no channel is configured — callers like "an invite
// was accepted" shouldn't fail their own request over an optional,
// best-effort notification.
func (s *NotifyService) Notify(ctx context.Context, eventType, title, body string, data map[string]any) error {
	sender, err := s.currentSender()
	if err != nil {
		return err
	}
	if sender == nil {
		return nil
	}
	return sender.Send(ctx, notify.Message{Title: title, Body: body, EventType: eventType, Data: data})
}

// SendTest sends a fixed test message through the configured channel, for
// an admin-settings "send test notification" action. Unlike Notify, it
// returns ErrNotificationsNotConfigured instead of silently no-oping,
// since the whole point of calling it is to verify the wiring.
func (s *NotifyService) SendTest(ctx context.Context) error {
	sender, err := s.currentSender()
	if err != nil {
		return err
	}
	if sender == nil {
		return ErrNotificationsNotConfigured
	}
	return sender.Send(ctx, notify.Message{
		Title:     "Hestia test notification",
		Body:      "If you can see this, your notification channel is configured correctly.",
		EventType: "test",
	})
}
