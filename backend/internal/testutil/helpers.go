package testutil

import (
	"net/http"
	"regexp"
	"testing"
)

// SignupResult is what POST /api/auth/signup returns.
type SignupResult struct {
	Household map[string]any `json:"household"`
	User      map[string]any `json:"user"`
}

// Signup creates a household via the real signup endpoint and returns the
// parsed result, failing the test on any non-201 response. The returned
// client already carries the resulting session cookies.
func Signup(t *testing.T, app *App, householdName, name, email, password string) (*http.Client, SignupResult) {
	t.Helper()
	client := app.Client(t)

	var result SignupResult
	resp := Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{
		"householdName": householdName,
		"name":          name,
		"email":         email,
		"password":      password,
	}, &result)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("signup(%s): status = %d", email, resp.StatusCode)
	}
	return client, result
}

var inviteTokenPattern = regexp.MustCompile(`/invite/([a-f0-9]{64})`)

// LastInviteToken extracts the raw invite token from the most recently
// captured SMTP message's body — the same way a real invitee would get it
// from the email they received.
func LastInviteToken(t *testing.T, smtp *FakeSMTP) string {
	t.Helper()
	messages := smtp.Messages()
	if len(messages) == 0 {
		t.Fatal("no SMTP messages captured")
	}
	last := messages[len(messages)-1]
	match := inviteTokenPattern.FindStringSubmatch(last.Body)
	if match == nil {
		t.Fatalf("no invite token found in captured message body: %q", last.Body)
	}
	return match[1]
}

var passwordResetTokenPattern = regexp.MustCompile(`/reset-password/([a-f0-9]{64})`)

// LastPasswordResetToken extracts the raw reset token from the most
// recently captured SMTP message's body — the same way a real user would
// get it from the email they received.
func LastPasswordResetToken(t *testing.T, smtp *FakeSMTP) string {
	t.Helper()
	messages := smtp.Messages()
	if len(messages) == 0 {
		t.Fatal("no SMTP messages captured")
	}
	last := messages[len(messages)-1]
	match := passwordResetTokenPattern.FindStringSubmatch(last.Body)
	if match == nil {
		t.Fatalf("no password reset token found in captured message body: %q", last.Body)
	}
	return match[1]
}
