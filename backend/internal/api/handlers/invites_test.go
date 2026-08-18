package handlers_test

import (
	"net/http"
	"testing"

	"hestia/backend/internal/testutil"
)

func TestInvites_HoHInviteFullFlow(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Admin HH", "Admin", "admin@example.com", "password123")

	var created map[string]any
	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/admin/invites", map[string]any{
		"email": "friend@example.com",
	}, &created)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create hoh invite: status = %d, body = %v", resp.StatusCode, created)
	}
	if created["emailSent"] != true {
		t.Fatalf("expected the invite email to send via the fake SMTP listener, got %v", created)
	}

	var list map[string]any
	testutil.Do(t, adminClient, "GET", app.BaseURL+"/api/admin/invites", nil, &list)
	invites, _ := list["invites"].([]any)
	if len(invites) != 1 {
		t.Fatalf("expected 1 hoh invite, got %d", len(invites))
	}

	// Capture the first invite's token before creating a second one below
	// (for revoke coverage) — SMTP message order would otherwise make
	// LastInviteToken return the wrong one for the accept flow further
	// down.
	token := testutil.LastInviteToken(t, app.SMTP)

	// A second, distinct hoh invite that this test revokes without ever
	// accepting — covers RevokeHoHInvite directly (the first invite goes
	// on to be accepted below, exercising the accept path instead).
	var secondInvite map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/admin/invites", map[string]any{"email": "revoke-me@example.com"}, &secondInvite)
	secondInviteObj, _ := secondInvite["invite"].(map[string]any)
	secondInviteID, _ := secondInviteObj["id"].(string)

	resp = testutil.Do(t, adminClient, "DELETE", app.BaseURL+"/api/admin/invites/"+secondInviteID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("revoke hoh invite: status = %d", resp.StatusCode)
	}
	resp = testutil.Do(t, adminClient, "DELETE", app.BaseURL+"/api/admin/invites/does-not-exist", nil, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("revoke unknown hoh invite: status = %d, want 404", resp.StatusCode)
	}

	var preview map[string]any
	resp = testutil.Do(t, adminClient, "GET", app.BaseURL+"/api/invites/"+token, nil, &preview)
	if resp.StatusCode != http.StatusOK || preview["role"] != "hoh" || preview["status"] != "pending" {
		t.Fatalf("invite preview: status = %d, body = %v", resp.StatusCode, preview)
	}

	friendClient := app.Client(t)
	var accepted map[string]any
	resp = testutil.Do(t, friendClient, "POST", app.BaseURL+"/api/invites/"+token+"/accept", map[string]any{
		"name": "Friend", "password": "password123", "householdName": "Friend HH",
	}, &accepted)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("accept invite: status = %d, body = %v", resp.StatusCode, accepted)
	}
	user, _ := accepted["user"].(map[string]any)
	if user["role"] != "hoh" || user["isSystemAdmin"] != false {
		t.Errorf("accepted hoh invite: expected role=hoh isSystemAdmin=false, got %v", user)
	}

	// The invitee is logged straight in — no separate login step needed.
	var me map[string]any
	resp = testutil.Do(t, friendClient, "GET", app.BaseURL+"/api/auth/me", nil, &me)
	if resp.StatusCode != http.StatusOK || me["user"] == nil {
		t.Errorf("friend should be logged in immediately after accepting: status = %d, body = %v", resp.StatusCode, me)
	}

	// The new household is fully isolated from the admin's.
	var friendHousehold map[string]any
	testutil.Do(t, friendClient, "GET", app.BaseURL+"/api/household", nil, &friendHousehold)
	if friendHousehold["name"] != "Friend HH" {
		t.Errorf("friend's household = %v, want Friend HH", friendHousehold["name"])
	}

	// The token is single-use.
	resp = testutil.Do(t, app.Client(t), "POST", app.BaseURL+"/api/invites/"+token+"/accept", map[string]any{
		"name": "Second", "password": "password123", "householdName": "X",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("re-accepting a used invite: status = %d, want 400", resp.StatusCode)
	}
}

func TestInvites_MemberInviteJoinsExistingHousehold(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var created map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members/invites", map[string]any{
		"email": "kid@example.com",
	}, &created)
	invite, _ := created["invite"].(map[string]any)
	if invite["role"] != "member" {
		t.Fatalf("expected a member invite, got %v", invite)
	}

	var list map[string]any
	resp := testutil.Do(t, adminClient, "GET", app.BaseURL+"/api/members/invites", nil, &list)
	memberInvites, _ := list["invites"].([]any)
	if resp.StatusCode != http.StatusOK || len(memberInvites) != 1 {
		t.Fatalf("list member invites: status = %d, count = %d", resp.StatusCode, len(memberInvites))
	}

	token := testutil.LastInviteToken(t, app.SMTP)

	var preview map[string]any
	testutil.Do(t, adminClient, "GET", app.BaseURL+"/api/invites/"+token, nil, &preview)
	if preview["householdName"] != "Test HH" {
		t.Errorf("member invite preview should show the household name, got %v", preview)
	}

	kidClient := app.Client(t)
	var accepted map[string]any
	resp = testutil.Do(t, kidClient, "POST", app.BaseURL+"/api/invites/"+token+"/accept", map[string]any{
		"name": "Kid", "password": "password123",
	}, &accepted)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("accept member invite: status = %d, body = %v", resp.StatusCode, accepted)
	}

	var household map[string]any
	testutil.Do(t, adminClient, "GET", app.BaseURL+"/api/household", nil, &household)
	var kidHousehold map[string]any
	testutil.Do(t, kidClient, "GET", app.BaseURL+"/api/household", nil, &kidHousehold)
	if household["id"] != kidHousehold["id"] {
		t.Errorf("expected the accepted member to land in the same household, admin=%v kid=%v", household["id"], kidHousehold["id"])
	}
}

func TestInvites_RevokeIsHouseholdScoped(t *testing.T) {
	app := testutil.New(t)
	adminAClient, _ := testutil.Signup(t, app, "Household A", "Admin A", "a@example.com", "password123")
	testutil.Signup(t, app, "Household B", "Admin B", "b@example.com", "password123")

	var created map[string]any
	testutil.Do(t, adminAClient, "POST", app.BaseURL+"/api/members/invites", map[string]any{"email": "target@example.com"}, &created)
	invite, _ := created["invite"].(map[string]any)
	inviteID, _ := invite["id"].(string)

	// A different household's admin can't revoke it — 404, not 403, so
	// as not to confirm the invite's existence to an outsider.
	adminBClient, _ := testutil.Signup(t, app, "Household C", "Admin C", "c@example.com", "password123")
	resp := testutil.Do(t, adminBClient, "DELETE", app.BaseURL+"/api/members/invites/"+inviteID, nil, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("cross-household revoke: status = %d, want 404", resp.StatusCode)
	}

	resp = testutil.Do(t, adminAClient, "DELETE", app.BaseURL+"/api/members/invites/"+inviteID, nil, nil)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("rightful owner revoking their own invite: status = %d, want 200", resp.StatusCode)
	}

	token := testutil.LastInviteToken(t, app.SMTP)
	var preview map[string]any
	testutil.Do(t, adminAClient, "GET", app.BaseURL+"/api/invites/"+token, nil, &preview)
	if preview["status"] != "revoked" {
		t.Errorf("expected revoked status after revoke, got %v", preview["status"])
	}
}

func TestInvites_DuplicateEmailRejected(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/admin/invites", map[string]any{
		"email": "admin@example.com",
	}, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("inviting an already-registered email: status = %d, want 409", resp.StatusCode)
	}
}

func TestInvites_OnlySystemAdminCanInviteHoH(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")

	var kid map[string]any
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members", map[string]any{"name": "Kid", "role": "member"}, &kid)
	kidID, _ := kid["id"].(string)
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/profiles/"+kidID+"/switch", map[string]any{}, nil)

	resp := testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/admin/invites", map[string]any{"email": "x@example.com"}, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-system-admin inviting a hoh: status = %d, want 403", resp.StatusCode)
	}
}

func TestInvites_UnknownTokenReturns404(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/invites/deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", nil, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown invite token: status = %d, want 404", resp.StatusCode)
	}
}

func TestInvites_AcceptShortPasswordRejected(t *testing.T) {
	app := testutil.New(t)
	adminClient, _ := testutil.Signup(t, app, "Test HH", "Admin", "admin@example.com", "password123")
	testutil.Do(t, adminClient, "POST", app.BaseURL+"/api/members/invites", map[string]any{"email": "kid@example.com"}, nil)
	token := testutil.LastInviteToken(t, app.SMTP)

	client := app.Client(t)
	resp := testutil.Do(t, client, "POST", app.BaseURL+"/api/invites/"+token+"/accept", map[string]any{
		"name": "Kid", "password": "short",
	}, nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("accept with a short password: status = %d, want 400", resp.StatusCode)
	}
}
