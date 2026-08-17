package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/services"
)

// GetNotificationSettings reports the instance's current admin-
// notification channel config. System-admin-only.
func (d *Deps) GetNotificationSettings(c *gin.Context) {
	settings, err := d.Notify.GetSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load notification settings"})
		return
	}
	c.JSON(http.StatusOK, settings)
}

type updateNotificationSettingsRequest struct {
	Provider string         `json:"provider"`
	Config   map[string]any `json:"config"`
}

// UpdateNotificationSettings replaces the instance's notification channel
// config. Provider "" clears it. System-admin-only.
func (d *Deps) UpdateNotificationSettings(c *gin.Context) {
	var req updateNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := d.Notify.UpdateSettings(req.Provider, req.Config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// TestNotificationSettings sends a fixed test message through the
// currently-configured channel, so an admin can verify wiring from the
// settings screen. System-admin-only.
func (d *Deps) TestNotificationSettings(c *gin.Context) {
	if err := d.Notify.SendTest(c.Request.Context()); err != nil {
		if errors.Is(err, services.ErrNotificationsNotConfigured) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to send test notification: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
