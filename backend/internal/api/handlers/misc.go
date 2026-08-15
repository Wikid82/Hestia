package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health is a trivial liveness check.
func (d *Deps) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// WS upgrades the connection to a WebSocket and registers it with the
// realtime hub.
func (d *Deps) WS(c *gin.Context) {
	d.Hub.ServeWS(c.Writer, c.Request)
}
