package services

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"hestia/backend/internal/database"
	"hestia/backend/internal/models"

	"github.com/Wikid82/go_notify_yourself/transport"
	"gorm.io/gorm"
)

// newTestDB opens a fresh temp-file SQLite database with migrations
// applied. A local copy of testutil.NewDB's logic: this file lives in
// package services (not services_test) so it can reach PushService's
// unexported fields, and testutil imports services — importing it here
// would be an import cycle.
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "hestia.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("opening test database: %v", err)
	}
	return db
}

// testSubscriberKeys generates a syntactically valid (but unrelated to any
// real browser) P-256 keypair/auth-secret pair, in the base64url encoding
// webpush.Config expects — enough for RFC 8291 encryption to succeed
// locally, regardless of what the fake "push service" on the other end
// does with the ciphertext.
func testSubscriberKeys(t *testing.T) (p256dh, auth string) {
	t.Helper()
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generating test subscriber keypair: %v", err)
	}
	p256dh = base64.RawURLEncoding.EncodeToString(priv.PublicKey().Bytes())

	authBytes := make([]byte, 16)
	if _, err := rand.Read(authBytes); err != nil {
		t.Fatalf("generating test auth secret: %v", err)
	}
	auth = base64.RawURLEncoding.EncodeToString(authBytes)
	return p256dh, auth
}

// newTestPushService builds a PushService whose transport.Wrapper allows
// plain HTTP and loopback destinations — the default, SSRF-safe wrapper
// (matching NotifyService's own posture) would otherwise reject an
// httptest.Server target, which is the only practical way to exercise
// SendToUser's real delivery/pruning behavior without a live push service.
func newTestPushService(db *gorm.DB, baseURL string) *PushService {
	return &PushService{
		db:      db,
		wrapper: transport.NewWrapper(transport.WithAllowHTTP(true)),
		baseURL: baseURL,
	}
}

func TestIsGoneStatus(t *testing.T) {
	cases := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errTest("webpush: failed to send web push: provider returned status 404"), true},
		{errTest("webpush: failed to send web push: provider returned status 410: gone"), true},
		{errTest("webpush: failed to send web push: provider returned status 500"), false},
		{errTest("webpush: VAPID subject is not configured"), false},
	}
	for _, tc := range cases {
		if got := isGoneStatus(tc.err); got != tc.want {
			t.Errorf("isGoneStatus(%v) = %v, want %v", tc.err, got, tc.want)
		}
	}
}

type errTest string

func (e errTest) Error() string { return string(e) }

func TestPushService_SendToUserDeliversAndPrunesGone(t *testing.T) {
	delivered := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer delivered.Close()

	gone := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGone)
	}))
	defer gone.Close()

	db := newTestDB(t)
	svc := newTestPushService(db, "https://hestia.example.com")

	p256dh1, auth1 := testSubscriberKeys(t)
	p256dh2, auth2 := testSubscriberKeys(t)
	if err := svc.Subscribe("user-1", SubscriptionInput{Endpoint: delivered.URL, P256dh: p256dh1, Auth: auth1}); err != nil {
		t.Fatalf("Subscribe (delivered): %v", err)
	}
	if err := svc.Subscribe("user-1", SubscriptionInput{Endpoint: gone.URL, P256dh: p256dh2, Auth: auth2}); err != nil {
		t.Fatalf("Subscribe (gone): %v", err)
	}

	err := svc.SendToUser(context.Background(), "user-1", PushMessage{Title: "Chore assigned", Body: "Take out the trash"})
	if err != nil {
		t.Errorf("SendToUser: err = %v, want nil (gone subscription pruned, not errored)", err)
	}

	var remaining []models.PushSubscription
	if err := db.Where("user_id = ?", "user-1").Find(&remaining).Error; err != nil {
		t.Fatalf("querying remaining subscriptions: %v", err)
	}
	if len(remaining) != 1 || remaining[0].Endpoint != delivered.URL {
		t.Errorf("expected only the delivered-to subscription to remain, got %+v", remaining)
	}
}

func TestPushService_SendToUserKeepsSubscriptionOnTransientFailure(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer failing.Close()

	db := newTestDB(t)
	svc := newTestPushService(db, "https://hestia.example.com")

	p256dh, auth := testSubscriberKeys(t)
	if err := svc.Subscribe("user-1", SubscriptionInput{Endpoint: failing.URL, P256dh: p256dh, Auth: auth}); err != nil {
		t.Fatalf("Subscribe: %v", err)
	}

	err := svc.SendToUser(context.Background(), "user-1", PushMessage{Title: "T", Body: "B"})
	if err == nil {
		t.Error("expected SendToUser to surface a non-gone delivery failure as an error")
	}

	var count int64
	db.Model(&models.PushSubscription{}).Where("user_id = ?", "user-1").Count(&count)
	if count != 1 {
		t.Errorf("expected the subscription to survive a transient (non-404/410) failure, got %d rows", count)
	}
}

func TestPushService_VapidSubjectDerivesHTTPSFromBaseURL(t *testing.T) {
	db := newTestDB(t)
	svc := NewPushService(db, "http://hestia.example.com:8080")

	got, err := svc.vapidSubject()
	if err != nil {
		t.Fatalf("vapidSubject returned an error: %v", err)
	}
	if want := "https://hestia.example.com:8080"; got != want {
		t.Errorf("vapidSubject() = %q, want %q", got, want)
	}
}

func TestPushService_VapidSubjectRejectsMalformedBaseURL(t *testing.T) {
	db := newTestDB(t)
	svc := NewPushService(db, "://not-a-url")

	if _, err := svc.vapidSubject(); err == nil {
		t.Error("expected an error for a malformed BASE_URL")
	}
}
