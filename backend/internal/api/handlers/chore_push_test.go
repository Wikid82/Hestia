package handlers_test

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"hestia/backend/internal/models"
	"hestia/backend/internal/testutil"
)

// newFakePushServer starts a local push-service stand-in and returns a hit
// counter — real delivery through the whole stack (handler -> ChoreService
// -> PushService -> go_notify_yourself's webpush provider ->
// transport.Wrapper) is only observable this way, since the default
// SSRF-safe transport otherwise rejects loopback destinations (correct in
// production; these tests build the app with testutil.Options.PushAllowHTTP
// to allow it).
func newFakePushServer(t *testing.T) (*httptest.Server, *int32) {
	t.Helper()
	var hits int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(server.Close)
	return server, &hits
}

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

func TestChores_CreateAssignmentSendsPush(t *testing.T) {
	app := testutil.NewWithOptions(t, testutil.Options{PushAllowHTTP: true})
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	server, hits := newFakePushServer(t)
	p256dh, auth := testSubscriberKeys(t)
	if err := app.DB.Create(&models.PushSubscription{
		ID: "sub-1", UserID: adminID, Endpoint: server.URL, P256dh: p256dh, Auth: auth,
	}).Error; err != nil {
		t.Fatalf("seeding push subscription: %v", err)
	}

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title":            "Dishes",
		"points":           10,
		"dueDate":          time.Now().Format("2006-01-02"),
		"recurrence":       "daily",
		"assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create chore: status = %d", resp.StatusCode)
	}

	if got := atomic.LoadInt32(hits); got != 1 {
		t.Errorf("push server hits = %d, want 1 (assignment push on create)", got)
	}
}

func TestChores_ReassignmentSendsPushToNewAssignee(t *testing.T) {
	app := testutil.NewWithOptions(t, testutil.Options{PushAllowHTTP: true})
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	server, hits := newFakePushServer(t)
	p256dh, auth := testSubscriberKeys(t)
	if err := app.DB.Create(&models.PushSubscription{
		ID: "sub-kid", UserID: kidID, Endpoint: server.URL, P256dh: p256dh, Auth: auth,
	}).Error; err != nil {
		t.Fatalf("seeding push subscription: %v", err)
	}

	var chore map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title":            "Dishes",
		"points":           10,
		"dueDate":          time.Now().Format("2006-01-02"),
		"recurrence":       "daily",
		"assignedToUserId": adminID,
	}, &chore)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create chore: status = %d", resp.StatusCode)
	}
	choreID, _ := chore["id"].(string)

	// Admin (no subscription) -> kid (subscribed): a real reassignment,
	// should fire.
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/chores/"+choreID, map[string]any{
		"title": "Dishes", "points": 10, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": kidID,
	}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("reassign chore: status = %d", resp.StatusCode)
	}
	if got := atomic.LoadInt32(hits); got != 1 {
		t.Fatalf("push server hits after reassignment = %d, want 1", got)
	}

	// Same assignee, unrelated field change -> should NOT fire again.
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/chores/"+choreID, map[string]any{
		"title": "Dishes (renamed)", "points": 10, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": kidID,
	}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unrelated update: status = %d", resp.StatusCode)
	}
	if got := atomic.LoadInt32(hits); got != 1 {
		t.Errorf("push server hits after unrelated edit = %d, want still 1 (no push for a non-reassignment edit)", got)
	}
}

func TestChores_CreateStillSucceedsWhenPushFails(t *testing.T) {
	// Default (non-allowHTTP) app: any subscription's push send fails
	// (SSRF-rejected loopback destination) — the chore create must still
	// succeed regardless, since push is a best-effort side channel.
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	p256dh, auth := testSubscriberKeys(t)
	if err := app.DB.Create(&models.PushSubscription{
		ID: "sub-1", UserID: adminID, Endpoint: "http://127.0.0.1:9/unreachable", P256dh: p256dh, Auth: auth,
	}).Error; err != nil {
		t.Fatalf("seeding push subscription: %v", err)
	}

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title":            "Dishes",
		"points":           10,
		"dueDate":          time.Now().Format("2006-01-02"),
		"recurrence":       "daily",
		"assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("create chore should succeed even if the assignee's push send fails: status = %d", resp.StatusCode)
	}
}
