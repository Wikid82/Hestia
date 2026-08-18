// Package testutil provides shared test infrastructure — a real in-process
// HTTP server backed by a real temp-file SQLite DB, and a minimal fake SMTP
// listener — so handler/service tests can exercise full request flows
// instead of hand-mocking every dependency. Excluded from coverage
// accounting (see codecov.yml and scripts/go-test-coverage.sh) since this
// is test infrastructure, not application code, and is only ever called
// from *_test.go files.
package testutil

import (
	"bufio"
	"net"
	"strings"
	"sync"
	"testing"
)

// Message is one email captured by FakeSMTP.
type Message struct {
	From, To, Subject, Body string
}

// FakeSMTP is a minimal, real TCP SMTP listener good enough for
// services.Mailer to talk to in tests: EHLO/MAIL/RCPT/DATA/QUIT, no auth,
// no TLS. Captures every delivered message for assertions.
type FakeSMTP struct {
	Addr string

	mu       sync.Mutex
	messages []Message
}

// StartFakeSMTP starts a FakeSMTP listening on an OS-assigned free port and
// stops it automatically when the test completes.
func StartFakeSMTP(t *testing.T) *FakeSMTP {
	t.Helper()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start fake SMTP listener: %v", err)
	}

	s := &FakeSMTP{Addr: ln.Addr().String()}

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return // listener closed
			}
			go s.handle(conn)
		}
	}()

	t.Cleanup(func() { _ = ln.Close() })
	return s
}

// Messages returns every message captured so far.
func (s *FakeSMTP) Messages() []Message {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Message, len(s.messages))
	copy(out, s.messages)
	return out
}

func (s *FakeSMTP) handle(conn net.Conn) {
	defer func() { _ = conn.Close() }()
	rw := bufio.NewReadWriter(bufio.NewReader(conn), bufio.NewWriter(conn))

	reply := func(line string) {
		_, _ = rw.WriteString(line + "\r\n")
		_ = rw.Flush()
	}

	reply("220 localhost fake smtp")

	var msg Message
	inData := false
	var dataLines []string

	for {
		line, err := rw.ReadString('\n')
		if err != nil {
			return
		}
		line = strings.TrimRight(line, "\r\n")

		if inData {
			if line == "." {
				inData = false
				msg.Body = strings.Join(dataLines, "\n")
				s.mu.Lock()
				s.messages = append(s.messages, msg)
				s.mu.Unlock()
				reply("250 OK")
				continue
			}
			dataLines = append(dataLines, line)
			if strings.HasPrefix(strings.ToLower(line), "subject:") {
				msg.Subject = strings.TrimSpace(line[len("subject:"):])
			}
			continue
		}

		upper := strings.ToUpper(line)
		switch {
		case strings.HasPrefix(upper, "EHLO"):
			// Multi-line: advertise AUTH so smtp.Client.Auth() (which
			// checks the EHLO extension list before attempting) doesn't
			// refuse to even try.
			_, _ = rw.WriteString("250-localhost\r\n")
			_, _ = rw.WriteString("250 AUTH PLAIN LOGIN\r\n")
			_ = rw.Flush()
		case strings.HasPrefix(upper, "HELO"):
			reply("250 localhost")
		case strings.HasPrefix(upper, "AUTH"):
			// Accept any credentials unconditionally — this is a test
			// double for exercising Mailer's auth code path, not for
			// validating auth itself.
			reply("235 Authentication successful")
		case strings.HasPrefix(upper, "MAIL FROM"):
			msg.From = extractAddr(line)
			reply("250 OK")
		case strings.HasPrefix(upper, "RCPT TO"):
			msg.To = extractAddr(line)
			reply("250 OK")
		case strings.HasPrefix(upper, "DATA"):
			inData = true
			dataLines = nil
			reply("354 End data with <CR><LF>.<CR><LF>")
		case strings.HasPrefix(upper, "QUIT"):
			reply("221 Bye")
			return
		default:
			reply("250 OK")
		}
	}
}

func extractAddr(line string) string {
	start := strings.Index(line, "<")
	end := strings.Index(line, ">")
	if start == -1 || end == -1 || end < start {
		return line
	}
	return line[start+1 : end]
}
