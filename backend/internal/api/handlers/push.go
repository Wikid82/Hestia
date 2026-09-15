package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

// GetVAPIDPublicKey returns this instance's VAPID public key, generating it
// on first use. The frontend needs this before it can call
// PushManager.subscribe. Any logged-in profile may call this.
func (d *Deps) GetVAPIDPublicKey(c *gin.Context) {
	key, err := d.Push.VAPIDPublicKey()
	if err != nil {
		if errors.Is(err, services.ErrBaseURLNotConfigured) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load VAPID key"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"publicKey": key})
}

type subscribeRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// Subscribe registers a browser Web Push subscription for the current
// profile.
func (d *Deps) Subscribe(c *gin.Context) {
	user := middleware.CurrentUser(c)

	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	err := d.Push.Subscribe(user.ID, services.SubscriptionInput{
		Endpoint: req.Endpoint,
		P256dh:   req.Keys.P256dh,
		Auth:     req.Keys.Auth,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type unsubscribeRequest struct {
	Endpoint string `json:"endpoint"`
}

// Unsubscribe removes a browser Web Push subscription for the current
// profile. Idempotent: unsubscribing an endpoint that isn't subscribed
// still returns 200.
func (d *Deps) Unsubscribe(c *gin.Context) {
	user := middleware.CurrentUser(c)

	var req unsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := d.Push.Unsubscribe(user.ID, req.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unsubscribe"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
