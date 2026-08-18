// Package handlers implements the HTTP handlers for Hestia's REST API.
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/realtime"
	"hestia/backend/internal/services"
)

// Deps bundles every dependency the handlers need: services, the auth
// service (for signing/verifying cookies), and the realtime hub.
type Deps struct {
	Auth      *services.AuthService
	Household *services.HouseholdService
	Member    *services.MemberService
	Chore     *services.ChoreService
	Reminder  *services.ReminderService
	Reward    *services.RewardService
	HHAuth    *services.HouseholdAuthService
	Mailer    *services.Mailer
	Notify    *services.NotifyService
	Invite    *services.InviteService
	Hub       *realtime.Hub
	// CookieSecure mirrors config.Config.CookieSecure — see there for why
	// it's independent of Gin's release/debug mode.
	CookieSecure bool
	// AllowPublicSignup and BaseURL mirror config.Config — see there for
	// what they mean. Deps carries them as plain values (like
	// CookieSecure) rather than the whole *config.Config, since handlers
	// only ever need these fields out of it.
	AllowPublicSignup bool
	BaseURL           string
}

func (d *Deps) setSessionCookie(c *gin.Context, householdID string) error {
	token, err := d.Auth.SignSession(householdID)
	if err != nil {
		return err
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.SessionCookie, token, services.MaxAgeSeconds, "/", "", d.CookieSecure, true)
	return nil
}

func (d *Deps) setProfileCookie(c *gin.Context, householdID, userID string) error {
	token, err := d.Auth.SignProfile(householdID, userID)
	if err != nil {
		return err
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.ProfileCookie, token, services.MaxAgeSeconds, "/", "", d.CookieSecure, true)
	return nil
}

func (d *Deps) clearAuthCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.SessionCookie, "", -1, "/", "", d.CookieSecure, true)
	c.SetCookie(services.ProfileCookie, "", -1, "/", "", d.CookieSecure, true)
}

func (d *Deps) clearProfileCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.ProfileCookie, "", -1, "/", "", d.CookieSecure, true)
}

// broadcastEvent fans out a small JSON event over the WS hub, e.g.
// {"type": "chore.completed", "choreId": "...", "userId": "..."}.
func (d *Deps) broadcastEvent(eventType string, fields map[string]any) {
	payload := map[string]any{"type": eventType}
	for k, v := range fields {
		payload[k] = v
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return
	}
	d.Hub.Broadcast(b)
}
