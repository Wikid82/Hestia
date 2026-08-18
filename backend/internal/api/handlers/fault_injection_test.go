package handlers_test

import (
	"net/http"
	"testing"
	"time"

	"hestia/backend/internal/testutil"
)

// TestFaultInjection_ListEndpoints poisons each resource's own table and
// confirms its List handler surfaces a 500 instead of panicking or
// leaking a different status — the "the DB call itself returned an
// unexpected error" branch every List handler has, otherwise unreachable
// (closing the whole DB connection trips RequireHousehold's own DB check
// first, before the handler under test is ever reached).
func TestFaultInjection_ListEndpoints(t *testing.T) {
	cases := []struct {
		name  string
		path  string
		table string
	}{
		{"list chores", "/api/chores", "chores"},
		// "list members" deliberately excluded: /api/members sits behind
		// RequireProfile, which itself SELECTs from "users" on every
		// request to load the active profile — poisoning "users" fails
		// that middleware check first (403) before ListMembers' own
		// "users" query is ever reached. Both are reads on the same
		// table, so there's no way to poison one without the other; see
		// TestFaultInjection_MemberCreateAndUpdate for the same table's
		// write path instead, which isn't shadowed the same way.
		{"list rewards", "/api/rewards", "rewards"},
		{"list reminders", "/api/reminders", "reminders"},
		// /api/profiles only sits behind RequireHousehold (not
		// RequireProfile — that's the whole point of the avatar picker),
		// so poisoning "users" here only affects ListProfiles' own query.
		{"list profiles", "/api/profiles", "users"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := testutil.New(t)
			client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

			testutil.PoisonTable(app.DB, tc.table)

			resp := testutil.Do(t, client, "GET", app.BaseURL+tc.path, nil, nil)
			if resp.StatusCode != http.StatusInternalServerError {
				t.Errorf("%s with %q poisoned: status = %d, want 500", tc.path, tc.table, resp.StatusCode)
			}
		})
	}
}

func TestFaultInjection_AdminInviteLists(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	testutil.PoisonTable(app.DB, "invites")

	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/admin/invites", nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("list hoh invites with invites poisoned: status = %d, want 500", resp.StatusCode)
	}
	resp = testutil.Do(t, client, "GET", app.BaseURL+"/api/members/invites", nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("list member invites with invites poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_DeleteEndpoints(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)

	var reward map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "X", "pointCost": 1}, &reward)
	rewardID, _ := reward["id"].(string)

	testutil.PoisonTable(app.DB, "chores")
	resp := testutil.Do(t, client, "DELETE", app.BaseURL+"/api/chores/"+choreID, nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("delete chore with chores poisoned: status = %d, want 500", resp.StatusCode)
	}

	testutil.PoisonTable(app.DB, "rewards")
	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/rewards/"+rewardID, nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("delete reward with rewards poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_CreateEndpoints(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	testutil.PoisonTable(app.DB, "chores")
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("create chore with chores poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_RewardCreateAndUpdate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reward map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "X", "pointCost": 1}, &reward)
	rewardID, _ := reward["id"].(string)

	testutil.PoisonTable(app.DB, "rewards")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "Y", "pointCost": 1}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("create reward with rewards poisoned: status = %d, want 500", resp.StatusCode)
	}
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/rewards/"+rewardID, map[string]any{"title": "Y", "pointCost": 1}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("update reward with rewards poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_ReminderCreateAndDelete(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reminder map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{"title": "X"}, &reminder)
	reminderID, _ := reminder["id"].(string)

	testutil.PoisonTable(app.DB, "reminders")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{"title": "Y"}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("create reminder with reminders poisoned: status = %d, want 500", resp.StatusCode)
	}
	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/reminders/"+reminderID, nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("delete reminder with reminders poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_MemberCreateAndUpdate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	testutil.PoisonTableWrites(app.DB, "users")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Y", "role": "member"}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("create member with users poisoned: status = %d, want 500", resp.StatusCode)
	}
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/members/"+kidID, map[string]any{"name": "Y", "role": "member"}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("update member with users poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_HouseholdRename(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	testutil.PoisonTableWrites(app.DB, "households")
	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/household", map[string]any{"name": "New Name"}, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("rename household with households poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_InviteRevoke(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var created map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/admin/invites", map[string]any{"email": "x@example.com"}, &created)
	invite, _ := created["invite"].(map[string]any)
	inviteID, _ := invite["id"].(string)

	testutil.PoisonTable(app.DB, "invites")
	resp := testutil.Do(t, client, "DELETE", app.BaseURL+"/api/admin/invites/"+inviteID, nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("revoke invite with invites poisoned: status = %d, want 500", resp.StatusCode)
	}
}

func TestFaultInjection_NotificationSettings(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	testutil.PoisonTable(app.DB, "notification_settings")
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/admin/notification-settings", nil, nil)
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("get notification settings with notification_settings poisoned: status = %d, want 500", resp.StatusCode)
	}
}
