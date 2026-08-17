package services

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"

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
		return fmt.Errorf("outbound email is not configured (SMTP_HOST/SMTP_PORT/SMTP_FROM unset)")
	}

	msg := buildMessage(m.cfg.From, to, subject, body)
	addr := net.JoinHostPort(m.cfg.Host, m.cfg.Port)

	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	}

	// SMTP_USE_TLS true (the default) means connect via implicit TLS, the
	// common pattern on port 465. When false, connect in plaintext and
	// let smtp.SendMail negotiate STARTTLS opportunistically if the
	// server offers it (the common pattern on port 587/25).
	if !m.cfg.UseTLS {
		return smtp.SendMail(addr, auth, m.cfg.From, []string{to}, msg)
	}

	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: m.cfg.Host})
	if err != nil {
		return fmt.Errorf("connecting to SMTP server: %w", err)
	}
	client, err := smtp.NewClient(conn, m.cfg.Host)
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
	return []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s",
		from, to, subject, body,
	))
}
