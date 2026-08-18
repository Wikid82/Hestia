package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestReminders_CreateListToggleDelete(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reminder map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{
		"title": "Take out trash", "dueAt": "2026-12-25",
	}, &reminder)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create reminder: status = %d, body = %v", resp.StatusCode, reminder)
	}
	reminderID, _ := reminder["id"].(string)

	var list map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/reminders", nil, &list)
	reminders, _ := list["reminders"].([]any)
	if len(reminders) != 1 {
		t.Errorf("expected 1 reminder, got %d", len(reminders))
	}

	var toggled map[string]any
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/reminders/"+reminderID+"/toggle", nil, &toggled)
	if resp.StatusCode != http.StatusOK || toggled["isDone"] != true {
		t.Errorf("toggle reminder: status = %d, body = %v", resp.StatusCode, toggled)
	}

	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/reminders/"+reminderID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("delete reminder: status = %d", resp.StatusCode)
	}
}

func TestReminders_RequiresTitle(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("create reminder without a title: status = %d, want 400", resp.StatusCode)
	}
}

func TestReminders_InvalidDueDateRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/reminders", map[string]any{
		"title": "Bad date", "dueAt": "not-a-date",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid due date: status = %d, want 400", resp.StatusCode)
	}
}

func TestReminders_MemberCannotAssignToSomeoneElse(t *testing.T) {
	app := testutil.New(t)
	adminClient, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	// The member tries to assign a reminder to the admin — the handler
	// silently redirects it to the member's own ID instead of erroring.
	var reminder map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/reminders", map[string]any{
		"title": "Sneaky", "assignedToUserId": adminID,
	}, &reminder)
	if reminder["assignedToUserId"] != kidID {
		t.Errorf("expected reminder to be silently reassigned to the creator (%s), got %v", kidID, reminder["assignedToUserId"])
	}
}

func TestReminders_DeleteRequiresOwnershipOrHoH(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	// A household-wide (unassigned) reminder created by the admin.
	var reminder map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/reminders", map[string]any{"title": "Whole household"}, &reminder)
	reminderID, _ := reminder["id"].(string)

	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)
	resp := testutil.Do(t, adminClient, "DELETE", app.BaseURL+"/api/reminders/"+reminderID, nil, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member deleting an unassigned reminder they didn't create: status = %d, want 403", resp.StatusCode)
	}
}
