package handlers_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/gorilla/websocket"

	"hestia/backend/internal/testutil"
)

func TestHealth(t *testing.T) {
	app := testutil.New(t)
	client := app.Client(t)

	var body map[string]any
	resp := testutil.Do(t, client, "GET", app.BaseURL+"/api/health", nil, &body)
	if resp.StatusCode != http.StatusOK || body["status"] != "ok" {
		t.Errorf("health check: status = %d, body = %v", resp.StatusCode, body)
	}
}

func TestWS_Upgrades(t *testing.T) {
	// Confirms /api/ws is actually wired to Hub.ServeWS end to end
	// (the handler itself is a one-line passthrough) — full
	// broadcast-content behavior is covered by internal/realtime's own
	// hub tests.
	app := testutil.New(t)

	wsURL := "ws" + strings.TrimPrefix(app.BaseURL, "http") + "/api/ws"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dialing /api/ws: %v", err)
	}
	defer func() { _ = conn.Close() }()
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("upgrade response status = %d, want 101", resp.StatusCode)
	}
}
