package realtime

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestHub_BroadcastReachesConnectedClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWS(w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dialing test websocket server: %v", err)
	}
	defer func() { _ = conn.Close() }()

	// Give the server a moment to finish registering the client before
	// broadcasting — registration happens in ServeWS, called from the
	// HTTP handler goroutine that just accepted this connection.
	time.Sleep(20 * time.Millisecond)

	hub.Broadcast([]byte(`{"type":"chore.completed"}`))

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("reading broadcast message: %v", err)
	}
	if string(msg) != `{"type":"chore.completed"}` {
		t.Errorf("received message = %q, want the broadcast payload", msg)
	}
}

func TestHub_DisconnectUnregistersClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWS(w, r)
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dialing test websocket server: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
	_ = conn.Close()
	time.Sleep(20 * time.Millisecond)

	hub.mu.Lock()
	remaining := len(hub.clients)
	hub.mu.Unlock()
	if remaining != 0 {
		t.Errorf("expected 0 registered clients after disconnect, got %d", remaining)
	}
}
