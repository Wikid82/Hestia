package services_test

import (
	"net"
	"testing"

	"hestia/backend/internal/config"
	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestMailer_NilConfigIsNotConfigured(t *testing.T) {
	m := services.NewMailer(nil)
	if m.IsConfigured() {
		t.Error("expected a nil SMTPConfig to report IsConfigured() == false")
	}
	if err := m.Send("to@example.com", "Subject", "Body"); err == nil {
		t.Error("expected Send to error when SMTP isn't configured")
	}
}

func TestMailer_SendViaFakeSMTP(t *testing.T) {
	smtp := testutil.StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}

	m := services.NewMailer(&config.SMTPConfig{
		Server: host, Port: port, From: "hestia@example.com", UseTLS: false,
	})
	if !m.IsConfigured() {
		t.Fatal("expected a non-nil SMTPConfig to report IsConfigured() == true")
	}

	if err := m.Send("someone@example.com", "Hello", "This is the body."); err != nil {
		t.Fatalf("Send returned an error: %v", err)
	}

	messages := smtp.Messages()
	if len(messages) != 1 {
		t.Fatalf("expected 1 captured message, got %d", len(messages))
	}
	if messages[0].From != "hestia@example.com" || messages[0].To != "someone@example.com" {
		t.Errorf("message envelope = %+v", messages[0])
	}
	if messages[0].Subject != "Hello" {
		t.Errorf("Subject = %q, want Hello", messages[0].Subject)
	}
}

func TestMailer_SendWithAuth(t *testing.T) {
	smtp := testutil.StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}

	// The fake SMTP server accepts any AUTH — this exercises the
	// Mailer.Send code path that issues smtp.PlainAuth when a username is
	// configured, not the relay's actual auth enforcement.
	m := services.NewMailer(&config.SMTPConfig{
		Server: host, Port: port, From: "hestia@example.com",
		Username: "hestia", Password: "secret", UseTLS: false,
	})

	if err := m.Send("someone@example.com", "Hi", "Body"); err != nil {
		t.Fatalf("Send with auth configured returned an error: %v", err)
	}
}

func TestMailer_SendConnectionFailure(t *testing.T) {
	// Nothing listening on this port — Send should return a wrapped
	// error, not panic.
	m := services.NewMailer(&config.SMTPConfig{
		Server: "127.0.0.1", Port: "1", From: "hestia@example.com", UseTLS: false,
	})
	if err := m.Send("someone@example.com", "Hi", "Body"); err == nil {
		t.Error("expected an error when the SMTP server is unreachable")
	}
}

func TestMailer_RejectsRecipientWithEmbeddedCRLF(t *testing.T) {
	smtp := testutil.StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}
	m := services.NewMailer(&config.SMTPConfig{
		Server: host, Port: port, From: "hestia@example.com", UseTLS: false,
	})

	// A crafted "recipient" trying to smuggle extra SMTP commands / mail
	// headers via embedded CRLF — must be rejected outright, not passed
	// through to RCPT TO or a header line (CWE-93).
	maliciousTo := "victim@example.com>\r\nRCPT TO:<attacker@evil.example"
	if err := m.Send(maliciousTo, "Hi", "Body"); err == nil {
		t.Error("expected Send to reject a recipient address containing CRLF")
	}
	if len(smtp.Messages()) != 0 {
		t.Error("expected no message to reach the SMTP server for a rejected recipient")
	}
}

func TestMailer_RejectsSubjectWithHeaderInjection(t *testing.T) {
	smtp := testutil.StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}
	m := services.NewMailer(&config.SMTPConfig{
		Server: host, Port: port, From: "hestia@example.com", UseTLS: false,
	})

	// A crafted household name (or any other future subject input) trying
	// to inject an extra header via embedded CRLF — must be rejected
	// outright, not passed through with the CRLF silently dropped: a real
	// subject line should never contain a line break in the first place.
	maliciousSubject := "Invite\r\nBcc: attacker@evil.example\r\nX-Injected: true"
	if err := m.Send("someone@example.com", maliciousSubject, "Body"); err == nil {
		t.Error("expected Send to reject a subject containing CRLF")
	}
	if len(smtp.Messages()) != 0 {
		t.Error("expected no message to reach the SMTP server for a rejected subject")
	}
}

func TestMailer_SendWithImplicitTLSFailsAgainstPlaintextServer(t *testing.T) {
	// The fake SMTP server speaks plaintext only — asking Mailer to dial
	// it via implicit TLS (UseTLS: true, the default) should fail
	// cleanly rather than hang or panic. This exercises the UseTLS-true
	// branch of Send, distinct from every other test in this file.
	smtp := testutil.StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}

	m := services.NewMailer(&config.SMTPConfig{
		Server: host, Port: port, From: "hestia@example.com", UseTLS: true,
	})
	if err := m.Send("someone@example.com", "Hi", "Body"); err == nil {
		t.Error("expected implicit TLS against a plaintext server to fail")
	}
}
