package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestRewards_CreateListUpdateToggleDelete(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reward map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{
		"title": "Movie night", "pointCost": 50,
	}, &reward)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create reward: status = %d, body = %v", resp.StatusCode, reward)
	}
	rewardID, _ := reward["id"].(string)

	var list map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/rewards", nil, &list)
	rewards, _ := list["rewards"].([]any)
	if len(rewards) != 1 {
		t.Errorf("expected 1 reward, got %d", len(rewards))
	}

	var updated map[string]any
	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/rewards/"+rewardID, map[string]any{
		"title": "Movie night (renamed)", "pointCost": 60,
	}, &updated)
	if resp.StatusCode != http.StatusOK || updated["title"] != "Movie night (renamed)" {
		t.Errorf("update reward: status = %d, body = %v", resp.StatusCode, updated)
	}

	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/rewards/"+rewardID+"/toggle", nil, &updated)
	if resp.StatusCode != http.StatusOK || updated["isActive"] != false {
		t.Errorf("toggle reward: status = %d, body = %v", resp.StatusCode, updated)
	}

	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/rewards/"+rewardID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("delete reward: status = %d", resp.StatusCode)
	}
}

func TestRewards_RedeemDeductsPoints(t *testing.T) {
	app := testutil.New(t)
	client, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	var chore map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores", map[string]any{
		"title": "Earn points", "points": 100, "dueDate": "2026-01-01",
		"recurrence": "daily", "assignedToUserId": adminID,
	}, &chore)
	choreID, _ := chore["id"].(string)
	testutil.Do(t, client, "POST", app.BaseURL+"/api/chores/"+choreID+"/complete", nil, nil)

	var reward map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{
		"title": "Treat", "pointCost": 30,
	}, &reward)
	rewardID, _ := reward["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards/"+rewardID+"/redeem", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("redeem reward: status = %d", resp.StatusCode)
	}

	var member map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/members/"+adminID, nil, &member)
	if points, _ := member["points"].(float64); points != 70 {
		t.Errorf("points after redeeming = %v, want 70", member["points"])
	}
}

func TestRewards_RedeemInsufficientPointsRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var reward map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{
		"title": "Expensive", "pointCost": 1000,
	}, &reward)
	rewardID, _ := reward["id"].(string)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards/"+rewardID+"/redeem", nil, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("redeem with insufficient points: status = %d, want 400", resp.StatusCode)
	}
}

func TestRewards_NonHoHCannotCreate(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)
	testutil.Do(t, client, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/rewards", map[string]any{"title": "Nope", "pointCost": 1}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member creating a reward: status = %d, want 403", resp.StatusCode)
	}
}
