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
	Auth       *services.AuthService
	Household  *services.HouseholdService
	Member     *services.MemberService
	Chore      *services.ChoreService
	Reminder   *services.ReminderService
	Reward     *services.RewardService
	HHAuth     *services.HouseholdAuthService
	Hub        *realtime.Hub
	Production bool
}

func (d *Deps) setSessionCookie(c *gin.Context, householdID string) error {
	token, err := d.Auth.SignSession(householdID)
	if err != nil {
		return err
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.SessionCookie, token, services.MaxAgeSeconds, "/", "", d.Production, true)
	return nil
}

func (d *Deps) setProfileCookie(c *gin.Context, householdID, userID string) error {
	token, err := d.Auth.SignProfile(householdID, userID)
	if err != nil {
		return err
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.ProfileCookie, token, services.MaxAgeSeconds, "/", "", d.Production, true)
	return nil
}

func (d *Deps) clearAuthCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.SessionCookie, "", -1, "/", "", d.Production, true)
	c.SetCookie(services.ProfileCookie, "", -1, "/", "", d.Production, true)
}

func (d *Deps) clearProfileCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(services.ProfileCookie, "", -1, "/", "", d.Production, true)
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
