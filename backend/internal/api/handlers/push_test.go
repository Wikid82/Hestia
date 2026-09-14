package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestPush_GetVAPIDPublicKey(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var body map[string]any
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/push/vapid-public-key", nil, &body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET vapid-public-key: status = %d, body = %v", resp.StatusCode, body)
	}
	key, _ := body["publicKey"].(string)
	if key == "" {
		t.Error("expected a non-empty publicKey")
	}

	// Stable across repeated calls.
	var body2 map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/push/vapid-public-key", nil, &body2)
	if body2["publicKey"] != key {
		t.Errorf("publicKey changed across calls: %v then %v", key, body2["publicKey"])
	}
}

func TestPush_SubscribeAndUnsubscribe(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	subscribeBody := map[string]any{
		"endpoint": "https://push.example.com/sub-1",
		"keys":     map[string]any{"p256dh": "test-p256dh", "auth": "test-auth"},
	}

	var ok map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/push/subscribe", subscribeBody, &ok)
	if resp.StatusCode != http.StatusOK || ok["ok"] != true {
		t.Fatalf("Subscribe: status = %d, body = %v", resp.StatusCode, ok)
	}

	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/push/unsubscribe", map[string]any{
		"endpoint": "https://push.example.com/sub-1",
	}, &ok)
	if resp.StatusCode != http.StatusOK || ok["ok"] != true {
		t.Fatalf("Unsubscribe: status = %d, body = %v", resp.StatusCode, ok)
	}

	// Idempotent: unsubscribing again (already gone) still succeeds.
	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/push/unsubscribe", map[string]any{
		"endpoint": "https://push.example.com/sub-1",
	}, &ok)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("repeat Unsubscribe: status = %d, want 200", resp.StatusCode)
	}
}

func TestPush_SubscribeMissingFieldsRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/push/subscribe", map[string]any{
		"endpoint": "https://push.example.com/sub-1",
		"keys":     map[string]any{"p256dh": "", "auth": ""},
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Subscribe with missing keys: status = %d, want 400", resp.StatusCode)
	}
}

func TestPush_SubscribeInvalidBodyRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp, err := client.Post(app.BaseURL+"/api/push/subscribe", "application/json", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Subscribe with no body: status = %d, want 400", resp.StatusCode)
	}
}
