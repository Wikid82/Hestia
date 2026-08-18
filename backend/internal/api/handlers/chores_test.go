package handlers_test

import (
	"net/http"
	"testing"
	"time"

	"hestia/backend/internal/testutil"
)

func TestChores_CreateListGetUpdateDelete(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title":            "Dishes",
		"points":           10,
		"dueDate":          time.Now().Format("2006-01-02"),
		"recurrence":       "daily",
		"assignedToUserId": adminID,
	}, &chore)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create chore: status = %d, body = %v", resp.StatusCode, chore)
	}
	choreID, _ := chore["id"].(string)

	var list map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/chores", nil, &list)
	chores, _ := list["chores"].([]any)
	if len(chores) != 1 {
		t.Errorf("expected 1 chore, got %d", len(chores))
	}

	var got map[string]any
	resp = testutil.Do(t, client, "GET", app.BaseURL+"/api/chores/"+choreID, nil, &got)
	if resp.StatusCode != http.StatusOK || got["title"] != "Dishes" {
		t.Errorf("get chore: status = %d, body = %v", resp.StatusCode, got)
	}

	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/chores/"+choreID, map[string]any{
		"title": "Dishes (renamed)", "points": 15, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &got)
	if resp.StatusCode != http.StatusOK || got["title"] != "Dishes (renamed)" {
		t.Errorf("update chore: status = %d, body = %v", resp.StatusCode, got)
	}

	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/chores/"+choreID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("delete chore: status = %d", resp.StatusCode)
	}
}

func TestChores_CompleteAndUncompleteAwardsPoints(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Dishes", "points": 10, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores/"+choreID+"/complete", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("complete chore: status = %d", resp.StatusCode)
	}

	var member map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/members/"+adminID, nil, &member)
	if points, _ := member["points"].(float64); points != 10 {
		t.Errorf("points after completing = %v, want 10", member["points"])
	}

	// Completing again the same day is a no-op, not an error.
	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/chores/"+choreID+"/complete", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("re-complete same day: status = %d, want 200 (no-op)", resp.StatusCode)
	}

	resp = testutil.Do(t, client, "POST", app.BaseURL+"/api/chores/"+choreID+"/uncomplete", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("uncomplete chore: status = %d", resp.StatusCode)
	}
	testutil.Do(t, client, "GET", app.BaseURL+"/api/members/"+adminID, nil, &member)
	if points, _ := member["points"].(float64); points != 0 {
		t.Errorf("points after uncompleting = %v, want 0", member["points"])
	}
}

func TestChores_CreateWithoutAssigneeRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "No assignee", "points": 5, "dueDate": time.Now().Format("2006-01-02"), "recurrence": "none",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("create chore without an assignee: status = %d, want 400", resp.StatusCode)
	}
}

func TestChores_NonHoHCannotCreate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)
	testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Nope", "points": 1, "dueDate": time.Now().Format("2006-01-02"), "recurrence": "none",
	}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member creating a chore: status = %d, want 403", resp.StatusCode)
	}
}

func TestChores_MemberCannotCompleteSomeoneElsesChore(t *testing.T) {
	app := testutil.New(t)
	adminClient, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	var chore map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Admin's chore", "points": 5, "dueDate": time.Now().Format("2006-01-02"),
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)

	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)
	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/chores/"+choreID+"/complete", nil, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member completing another member's chore: status = %d, want 403", resp.StatusCode)
	}
}
