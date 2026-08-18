package testutil

import "testing"

func TestNew_SignupSmoke(t *testing.T) {
	app := New(t)
	client := app.Client(t)

	var resp map[string]any
	r := Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{
		"householdName": "Test HH",
		"name":          "Admin",
		"email":         "admin@example.com",
		"password":      "password123",
	}, &resp)

	if r.StatusCode != 201 {
		t.Fatalf("signup: status = %d, body = %v", r.StatusCode, resp)
	}
	if resp["household"] == nil || resp["user"] == nil {
		t.Fatalf("signup response missing household/user: %v", resp)
	}
}
