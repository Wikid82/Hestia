package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestSignup_Success(t *testing.T) {
	app := testutil.New(t)
	client, result := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	if result.Household["name"] != "Test HH" {
		t.Errorf("household name = %v, want Test HH", result.Household["name"])
	}
	if result.User["role"] != "hoh" {
		t.Errorf("user role = %v, want hoh", result.User["role"])
	}
	if result.User["isSystemAdmin"] != true {
		t.Errorf("first signup should be isSystemAdmin, got %v", result.User["isSystemAdmin"])
	}

	// The signup response should have already set both cookies — /me
	// should report the fully-authed state without any further login.
	var me map[string]any
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/auth/me", nil, &me)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /me: status = %d", resp.StatusCode)
	}
	if me["user"] == nil {
		t.Errorf("expected /me to report an active profile immediately after signup, got %v", me)
	}
}

func TestSignup_DuplicateEmailRejected(t *testing.T) {
	app := testutil.New(t)
	testutil.Signup(t, app, "HH One", "Admin", "dupe@example.com", "password123")

	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{
		"householdName": "HH Two",
		"name":          "Someone Else",
		"email":         "dupe@example.com",
		"password":      "password123",
	}, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("duplicate-email signup: status = %d, want 409", resp.StatusCode)
	}
}

func TestSignup_ShortPasswordRejected(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{
		"householdName": "HH",
		"name":          "Admin",
		"email":         "short@example.com",
		"password":      "short",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("short-password signup: status = %d, want 400", resp.StatusCode)
	}
}

func TestSignup_SecondSignupBlockedWhenPublicSignupClosed(t *testing.T) {
	closed := false
	app := testutil.NewWithOptions(t, testutil.Options{AllowPublicSignup: &closed})

	// First signup always succeeds regardless of the flag (bootstrap).
	testutil.Signup(t, app, "First HH", "Admin", "first@example.com", "password123")

	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{
		"householdName": "Second HH",
		"name":          "Someone",
		"email":         "second@example.com",
		"password":      "password123",
	}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("second signup with ALLOW_PUBLIC_SIGNUP=false: status = %d, want 403", resp.StatusCode)
	}
}

func TestLogin_Success(t *testing.T) {
	app := testutil.New(t)
	testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	client := app.Client(t)
	var result map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/login", map[string]any{
		"email":    "admin@example.com",
		"password": "password123",
	}, &result)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login: status = %d", resp.StatusCode)
	}
	if result["user"] == nil {
		t.Errorf("expected login response to include the user, got %v", result)
	}
}

func TestLogin_WrongPasswordRejected(t *testing.T) {
	app := testutil.New(t)
	testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/login", map[string]any{
		"email":    "admin@example.com",
		"password": "wrong-password",
	}, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("wrong password: status = %d, want 401", resp.StatusCode)
	}
}

func TestLogin_UnknownEmailRejected(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/login", map[string]any{
		"email":    "nobody@example.com",
		"password": "password123",
	}, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("unknown email: status = %d, want 401", resp.StatusCode)
	}
}

func TestMe_UnauthenticatedReturns401(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/auth/me", nil, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("unauthenticated /me: status = %d, want 401", resp.StatusCode)
	}
}

func TestLogout_ClearsSession(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/logout", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("logout: status = %d", resp.StatusCode)
	}

	meResp := testutil.Do(t, client, "GET", app.BaseURL+"/api/auth/me", nil, nil)
	if meResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("/me after logout: status = %d, want 401", meResp.StatusCode)
	}
}

func TestProfiles_ListAndSwitch(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var list map[string]any
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/profiles", nil, &list)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list profiles: status = %d", resp.StatusCode)
	}
	profiles, _ := list["profiles"].([]any)
	if len(profiles) != 1 {
		t.Fatalf("expected exactly 1 profile after signup, got %d", len(profiles))
	}

	// SwitchToPicker drops the active profile without logging out of the
	// household session.
	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/to-picker", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("switch to picker: status = %d", resp.StatusCode)
	}
	var me map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/auth/me", nil, &me)
	if me["user"] != nil {
		t.Errorf("expected no active profile after switch-to-picker, got %v", me["user"])
	}

	// Switching back to the admin's own profile should work with no PIN
	// (none was ever set).
	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+adminID+"/switch", map[string]any{}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("switch profile: status = %d", resp.StatusCode)
	}
}

func TestSwitchProfile_UnknownIDReturns404(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/does-not-exist/switch", map[string]any{}, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("switch to unknown profile: status = %d, want 404", resp.StatusCode)
	}
}
