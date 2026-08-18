package handlers_test

import (
	"net/http"
	"testing"
	"time"

	"hestia/backend/internal/testutil"
)

// TestNotFound_UnknownIDs exercises the "record doesn't exist in this
// household" branch across every resource's Get/Update/Delete — a single
// table-driven test rather than one function per resource, since the
// assertion shape (404 for an unknown ID) is identical throughout.
func TestNotFound_UnknownIDs(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	const missing = "00000000-0000-0000-0000-000000000000"

	cases := []struct {
		name       string
		method     string
		path       string
		body       map[string]any
		wantStatus int
	}{
		{"get chore", "GET", "/api/chores/" + missing, nil, http.StatusNotFound},
		{"update chore", "PATCH", "/api/chores/" + missing, map[string]any{
			"title": "x", "points": 1, "dueDate": time.Now().Format("2006-01-02"), "recurrence": "none", "assignedToUserId": missing,
		}, http.StatusNotFound},
		// Delete is idempotent by design (a bare `Where(...).Delete()`
		// with no RowsAffected check) — deleting something that was
		// never there succeeds rather than erroring.
		{"delete chore", "DELETE", "/api/chores/" + missing, nil, http.StatusOK},
		{"complete chore", "POST", "/api/chores/" + missing + "/complete", nil, http.StatusNotFound},
		{"get member", "GET", "/api/members/" + missing, nil, http.StatusNotFound},
		{"update member", "PATCH", "/api/members/" + missing, map[string]any{"name": "x", "role": "member"}, http.StatusNotFound},
		{"delete member", "DELETE", "/api/members/" + missing, nil, http.StatusNotFound},
		{"clear pin on unknown member", "DELETE", "/api/members/" + missing + "/pin", nil, http.StatusNotFound},
		{"set member credentials", "PATCH", "/api/members/" + missing + "/credentials", map[string]any{"email": "x@example.com", "password": "password123"}, http.StatusNotFound},
		{"toggle unknown reward", "PATCH", "/api/rewards/" + missing + "/toggle", nil, http.StatusNotFound},
		{"delete unknown reward", "DELETE", "/api/rewards/" + missing, nil, http.StatusOK},
		// Redeem deliberately conflates "doesn't exist" with "not
		// currently available" (400), rather than leaking existence via
		// a distinct 404.
		{"redeem unknown reward", "POST", "/api/rewards/" + missing + "/redeem", nil, http.StatusBadRequest},
		{"toggle unknown reminder", "PATCH", "/api/reminders/" + missing + "/toggle", nil, http.StatusNotFound},
		{"delete unknown reminder", "DELETE", "/api/reminders/" + missing, nil, http.StatusNotFound},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := testutil.Do(t, client, tc.method, app.BaseURL+tc.path, tc.body, nil)
			if resp.StatusCode != tc.wantStatus {
				t.Errorf("%s %s: status = %d, want %d", tc.method, tc.path, resp.StatusCode, tc.wantStatus)
			}
		})
	}
}

func TestChores_UpdateRejectsInvalidRecurrence(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/chores/"+choreID, map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "bogus", "assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid recurrence: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_NegativePointsRejected(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": -5, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("negative points: status = %d, want 400", resp.StatusCode)
	}
}

func TestRewards_EmptyTitleRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"pointCost": 10}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("empty title: status = %d, want 400", resp.StatusCode)
	}
}

func TestRewards_NegativePointCostRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "X", "pointCost": -1}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("negative point cost: status = %d, want 400", resp.StatusCode)
	}
}

func TestMembers_UpdateRequiresName(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/members/"+kidID, map[string]any{"role": "member"}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("update member without a name: status = %d, want 400", resp.StatusCode)
	}
}

func TestInvites_CreateMemberInviteRequiresEmail(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/members/invites", map[string]any{}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("member invite without an email: status = %d, want 400", resp.StatusCode)
	}
}

func TestInvites_CreateHoHInviteRequiresEmail(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/admin/invites", map[string]any{}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("hoh invite without an email: status = %d, want 400", resp.StatusCode)
	}
}
