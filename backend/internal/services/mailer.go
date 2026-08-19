package services

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"

	"hestia/backend/internal/config"
)

// Mailer sends outbound email over SMTP. It's constructed once at boot
// from config.SMTPConfig and is nil-safe to call when SMTP isn't
// configured — callers should check IsConfigured before relying on
// Send actually delivering anything.
type Mailer struct {
	cfg *config.SMTPConfig
}

func NewMailer(cfg *config.SMTPConfig) *Mailer {
	return &Mailer{cfg: cfg}
}

// IsConfigured reports whether SMTP settings were provided at boot.
func (m *Mailer) IsConfigured() bool {
	return m != nil && m.cfg != nil
}

// Send delivers a plain-text email. Returns an error if SMTP isn't
// configured — callers that offer email-dependent features (invites)
// should check IsConfigured up front and surface a clearer error instead
// of relying on this one.
func (m *Mailer) Send(to, subject, body string) error {
	if !m.IsConfigured() {
		return fmt.Errorf("outbound email is not configured (SMTP_SERVER/SMTP_PORT/SMTP_FROM unset)")
	}

	// to comes from user-controlled input (an invite's email address) and
	// subject can embed another user-controlled field (a household name)
	// — both flow straight into raw RFC 5322 header lines below. Without
	// this, a crafted value containing CRLF could inject extra headers or
	// splice in a fabricated message body (CWE-93 header/content
	// injection). mail.ParseAddress rejects anything that isn't a single
	// well-formed address, which inherently rules out embedded CR/LF.
	parsedTo, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("invalid recipient address: %w", err)
	}
	to = parsedTo.Address
	subject = sanitizeHeaderValue(subject)

	msg := buildMessage(m.cfg.From, to, subject, body)
	addr := net.JoinHostPort(m.cfg.Server, m.cfg.Port)

	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Server)
	}

	// SMTP_USE_TLS true (the default) means connect via implicit TLS, the
	// common pattern on port 465. When false, connect in plaintext and
	// let smtp.SendMail negotiate STARTTLS opportunistically if the
	// server offers it (the common pattern on port 587/25).
	if !m.cfg.UseTLS {
		return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, msg)
	}

	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: m.cfg.Server})
	if err != nil {
		return fmt.Errorf("connecting to SMTP server: %w", err)
	}
	client, err := smtp.NewClient(conn, m.cfg.Server)
	if err != nil {
		return fmt.Errorf("starting SMTP session: %w", err)
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP auth failed: %w", err)
		}
	}
	if err := client.Mail(m.cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func buildMessage(from, to, subject, body string) []byte {
	// from is env-var-only (see config.SMTPConfig), so it's trusted at
	// runtime, but sanitizing it too costs nothing and keeps this
	// function safe to call with any input, not just today's callers.
	from = sanitizeHeaderValue(from)
	to = sanitizeHeaderValue(to)
	subject = sanitizeHeaderValue(subject)
	return []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s",
		from, to, subject, body,
	))
}

// sanitizeHeaderValue strips CR and LF so a value can never break out of
// its own header line and inject additional headers or an early
// body/header separator (CWE-93). Send already validates/normalizes `to`
// via mail.ParseAddress and sanitizes `subject` before reaching here —
// this is defense in depth for buildMessage's other callers, current or
// future.
func sanitizeHeaderValue(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "")
	return s
}
