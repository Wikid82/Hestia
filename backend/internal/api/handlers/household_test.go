package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestHousehold_GetAndUpdate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var got map[string]any
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/household", nil, &got)
	if resp.StatusCode != http.StatusOK || got["name"] != "Test HH" {
		t.Fatalf("get household: status = %d, body = %v", resp.StatusCode, got)
	}

	var updated map[string]any
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{
		"name": "Renamed HH", "themePreference": "dark",
	}, &updated)
	if resp.StatusCode != http.StatusOK || updated["name"] != "Renamed HH" || updated["themePreference"] != "dark" {
		t.Errorf("update household: status = %d, body = %v", resp.StatusCode, updated)
	}
}

func TestHousehold_InvalidThemeRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{
		"name": "Test HH", "themePreference": "not-a-real-theme",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid theme: status = %d, want 400", resp.StatusCode)
	}
}

func TestHousehold_NonHoHCannotUpdate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)
	testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{"name": "Nope"}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member updating household: status = %d, want 403", resp.StatusCode)
	}
}

func TestHousehold_TwoHouseholdsAreFullyIsolated(t *testing.T) {
	app := testutil.New(t)
	clientA, _ := testutil.Signup(t, app, "Household A", "Admin A", "a@example.com", "password123")
	clientB, _ := testutil.Signup(t, app, "Household B", "Admin B", "b@example.com", "password123")

	var householdA map[string]any
	testutil.Do(t, clientA, "GET", app.BaseURL+"/api/household", nil, &householdA)

	var membersB map[string]any
	testutil.Do(t, clientB, "GET", app.BaseURL+"/api/members", nil, &membersB)
	members, _ := membersB["members"].([]any)
	if len(members) != 1 {
		t.Fatalf("household B should only see its own 1 member, got %d", len(members))
	}
	firstMember, _ := members[0].(map[string]any)
	if firstMember["name"] != "Admin B" {
		t.Errorf("household B's member list leaked household A's data: %v", members)
	}
}
