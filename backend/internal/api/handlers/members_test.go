package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestMembers_CreateListGetUpdateDelete(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Kid", "role": "member", "avatarEmoji": "🙂",
	}, &kid)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create member: status = %d", resp.StatusCode)
	}
	kidID, _ := kid["id"].(string)
	if kidID == "" {
		t.Fatal("create member: no id in response")
	}

	var list map[string]any
	testutil.Do(t, client, "GET", app.BaseURL+"/api/members", nil, &list)
	members, _ := list["members"].([]any)
	if len(members) != 2 { // admin + kid
		t.Errorf("expected 2 members, got %d", len(members))
	}

	var got map[string]any
	resp = testutil.Do(t, client, "GET", app.BaseURL+"/api/members/"+kidID, nil, &got)
	if resp.StatusCode != http.StatusOK || got["name"] != "Kid" {
		t.Errorf("get member: status = %d, body = %v", resp.StatusCode, got)
	}

	resp = testutil.Do(t, client, "PATCH", app.BaseURL+"/api/members/"+kidID, map[string]any{
		"name": "Kid Renamed", "role": "member", "avatarEmoji": "🙂", "pin": "1234",
	}, &got)
	if resp.StatusCode != http.StatusOK || got["name"] != "Kid Renamed" {
		t.Errorf("update member: status = %d, body = %v", resp.StatusCode, got)
	}
	if got["hasPin"] != true {
		t.Errorf("expected hasPin=true after setting a PIN, got %v", got["hasPin"])
	}

	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/members/"+kidID+"/pin", nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("clear pin: status = %d", resp.StatusCode)
	}

	resp = testutil.Do(t, client, "DELETE", app.BaseURL+"/api/members/"+kidID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("delete member: status = %d", resp.StatusCode)
	}
}

func TestMembers_CreateRequiresName(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{"role": "member"}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("create member with no name: status = %d, want 400", resp.StatusCode)
	}
}

func TestMembers_NonHoHCannotCreate(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Kid", "role": "member",
	}, &kid)
	kidID, _ := kid["id"].(string)

	// Reuse the admin's household session, but switch its active profile
	// to the kid — profile-switch only replaces the profile cookie, so
	// this client now acts as the kid for permission purposes.
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Another Kid", "role": "member",
	}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("member (not hoh) creating a member: status = %d, want 403", resp.StatusCode)
	}
}

func TestMembers_SetCredentialsAndSelfServiceChange(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Kid", "role": "member",
	}, &kid)
	kidID, _ := kid["id"].(string)

	// HoH sets up the kid's login — no current password required.
	var updated map[string]any
	resp := testutil.Do(t, adminClient, "PATCH", app.BaseURL+"/api/members/"+kidID+"/credentials", map[string]any{
		"email": "kid@example.com", "password": "kidpassword1",
	}, &updated)
	if resp.StatusCode != http.StatusOK || updated["email"] != "kid@example.com" {
		t.Fatalf("set member credentials: status = %d, body = %v", resp.StatusCode, updated)
	}

	// The kid can now log in directly, bypassing the avatar picker.
	kidClient := app.Client(t)
	resp = testutil.Do(t, kidClient, "POST", app.BaseURL+"/api/auth/login", map[string]any{
		"email": "kid@example.com", "password": "kidpassword1",
	}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("kid direct login: status = %d", resp.StatusCode)
	}
	testutil.Do(t, kidClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	// Self-service change without the correct current password fails.
	resp = testutil.Do(t, kidClient, "PATCH", app.BaseURL+"/api/members/me/credentials", map[string]any{
		"email": "kid@example.com", "password": "newpassword2",
	}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("self change without current password: status = %d, want 403", resp.StatusCode)
	}

	// With the correct current password, it succeeds.
	resp = testutil.Do(t, kidClient, "PATCH", app.BaseURL+"/api/members/me/credentials", map[string]any{
		"email": "kid@example.com", "password": "newpassword2", "currentPassword": "kidpassword1",
	}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("self change with correct current password: status = %d", resp.StatusCode)
	}
}

func TestMembers_DuplicateEmailRejectedOnSetCredentials(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	resp := testutil.Do(t, adminClient, "PATCH", app.BaseURL+"/api/members/"+kidID+"/credentials", map[string]any{
		"email": "admin@example.com", "password": "password123",
	}, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("duplicate email on set credentials: status = %d, want 409", resp.StatusCode)
	}
}

func TestMembers_DeleteLastHoHRejected(t *testing.T) {
	app := testutil.New(t)
	adminClient, signup := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	adminID, _ := signup.User["id"].(string)

	resp := testutil.Do(t, adminClient, "DELETE", app.BaseURL+"/api/members/"+adminID, nil, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("delete the only hoh: status = %d, want 403", resp.StatusCode)
	}
}

func TestMembers_DeleteMemberWithLoginNowAllowed(t *testing.T) {
	// Regression test: MemberService.Delete used to refuse deleting any
	// profile with a password set at all, which (pre-invite-system) only
	// ever happened to be the founding admin. Now that any member can get
	// a login, that old check would incorrectly block deleting an
	// ordinary member too — the real invariant is "don't delete the last
	// hoh," not "don't delete anyone with a password."
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)

	testutil.Do(t, adminClient, "PATCH", app.BaseURL+"/api/members/"+kidID+"/credentials", map[string]any{
		"email": "kid@example.com", "password": "kidpassword1",
	}, nil)

	resp := testutil.Do(t, adminClient, "DELETE", app.BaseURL+"/api/members/"+kidID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("delete a member with a login: status = %d, want 200", resp.StatusCode)
	}
}

func TestMembers_InvalidPINRejected(t *testing.T) {
	app := testutil.New(t)
	client, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/members", map[string]any{
		"name": "Kid", "role": "member", "pin": "abc",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("invalid pin: status = %d, want 400", resp.StatusCode)
	}
}
