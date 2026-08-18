package handlers_test

import (
	"net/http"
	"testing"
	"time"

	"hestia/backend/internal/testutil"
)

func TestChores_InvalidDueDateRejected(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": "not-a-date", "recurrence": "none", "assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid due date: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_CustomRecurrenceRequiresDays(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "custom", "assignedToUserId": adminID,
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("custom recurrence with no days: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_CustomRecurrenceWithDaysSucceeds(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "custom", "recurrenceDays": []int{1, 3, 5}, "assignedToUserId": adminID,
	}, &chore)
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("custom recurrence with days: status = %d, body = %v", resp.StatusCode, chore)
	}
}

func TestChores_DueTodayFilter(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Due today", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, nil)
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Due next year", "points": 1, "dueDate": time.Now().AddDate(1, 0, 0).Format("2006-01-02"),
		"recurrence": "none", "assignedToUserId": adminID,
	}, nil)

	var list map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/chores?due=today", nil, &list)
	chores, _ := list["chores"].([]any)
	if len(chores) != 1 {
		t.Errorf("due=today filter: expected 1 chore, got %d", len(chores))
	}
}

func TestChores_UncompleteNotCompletedIsANoOp(t *testing.T) {
	// Mirrors Complete's own "already done" no-op behavior: uncompleting
	// something that was never completed isn't an error, just a no-op
	// success — matches ErrUnassigned/ErrNotCompleted both mapping to 200
	// in the handler.
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "X", "points": 1, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores/"+choreID+"/uncomplete", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("uncomplete a chore never completed: status = %d, want 200 (no-op)", resp.StatusCode)
	}
}

func TestRewards_UpdateEmptyTitleRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reward map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "X", "pointCost": 10}, &reward)
	rewardID, _ := reward["id"].(string)

	resp := testutil.Do(t, client, "PATCH", app.BaseURL+"/api/rewards/"+rewardID, map[string]any{"pointCost": 10}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("update reward with empty title: status = %d, want 400", resp.StatusCode)
	}
}

func TestProfiles_PINGatedSwitch(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Kid", "role": "member", "pin": "4242",
	}, &kid)
	kidID, _ := kid["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("switch to PIN-gated profile with no PIN: status = %d, want 403", resp.StatusCode)
	}

	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{"pin": "0000"}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("switch with wrong PIN: status = %d, want 403", resp.StatusCode)
	}

	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{"pin": "4242"}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("switch with correct PIN: status = %d, want 200", resp.StatusCode)
	}
}

func TestSignup_InvalidRequestBodyRejected(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/signup", map[string]any{"householdName": "X"}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("signup missing required fields: status = %d, want 400", resp.StatusCode)
	}
}

func TestLogin_InvalidRequestBodyRejected(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/auth/login", map[string]any{}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("login missing required fields: status = %d, want 400", resp.StatusCode)
	}
}
