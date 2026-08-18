package handlers_test

import (
	"bytes"
	"net/http"
	"testing"
	"time"

	"hestia/backend/internal/testutil"
)

func TestMembers_MalformedJSONBodyRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	req, err := http.NewRequest("PATCH", app.BaseURL+"/api/members/me/credentials", bytes.NewReader([]byte("not json")))
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("malformed JSON body: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_AssignToUnknownUserRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": "00000000-0000-0000-0000-000000000000",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("assign to a user not in this household: status = %d, want 400", resp.StatusCode)
	}
}

func TestRequireProfile_NoActiveProfileForbidden(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	// Household session still valid, but no active profile.
	testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/to-picker", nil, nil)

	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/members", nil, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("profile-requiring endpoint with no active profile: status = %d, want 403", resp.StatusCode)
	}
}

func TestHousehold_EmptyNameRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{"name": ""}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("empty household name: status = %d, want 400", resp.StatusCode)
	}
}

func TestHousehold_ThemeOnlyUpdateLeavesNameUnchanged(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var updated map[string]any
	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{"themePreference": "light"}, &updated)
	if resp.StatusCode != http.StatusOK || updated["name"] != "Test HH" || updated["themePreference"] != "light" {
		t.Errorf("theme-only update: status = %d, body = %v", resp.StatusCode, updated)
	}
}

func TestRewards_UpdateUnknownRewardReturns404(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/rewards/00000000-0000-0000-0000-000000000000", map[string]any{
		"title": "X", "pointCost": 10,
	}, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("update unknown reward: status = %d, want 404", resp.StatusCode)
	}
}

func TestReminders_AssignToUnknownUserRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{
		"title": "X", "assignedToUserId": "00000000-0000-0000-0000-000000000000",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("reminder assigned to an unknown user: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_MemberCannotUncompleteSomeoneElsesChore(t *testing.T) {
	app := testutil.New(t)
	adminClient, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	var chore map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/chores/"+choreID+"/complete", nil, nil)

	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)
	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/chores/"+choreID+"/uncomplete", nil, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member uncompleting another member's chore: status = %d, want 403", resp.StatusCode)
	}
}

func TestRequireHousehold_NoSessionAtAllUnauthorized(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t) // never authenticated at all

	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/members", nil, nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session at all: status = %d, want 401", resp.StatusCode)
	}
}
