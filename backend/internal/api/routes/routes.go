// Package routes wires up the Gin router: middleware chains plus every
// resource's REST endpoints.
package routes

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hestia/backend/internal/api/handlers"
	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

// Register mounts every route onto router.
func Register(router *gin.Engine, d *handlers.Deps, db *gorm.DB, auth *services.AuthService) {
	requireHousehold := middleware.RequireHousehold(auth, db)
	requireProfile := middleware.RequireProfile(auth, db)
	requireAdmin := middleware.RequireAdmin()

	router.GET("/api/health", d.Health)
	router.GET("/api/ws", d.WS)

	api := router.Group("/api")

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/signup", d.Signup)
		authGroup.POST("/login", d.Login)
		authGroup.POST("/logout", d.Logout)
		authGroup.GET("/me", requireHousehold, d.Me)
	}

	// Profiles: listing/switching only needs a household session, not an
	// already-active profile (that's the point of the avatar picker).
	profiles := api.Group("/profiles")
	profiles.Use(requireHousehold)
	{
		profiles.GET("", d.ListProfiles)
		profiles.POST("/:id/switch", d.SwitchProfile)
		profiles.POST("/to-picker", d.SwitchToPicker)
	}

	// Everything below requires both a household session and an active
	// profile.
	authed := api.Group("")
	authed.Use(requireHousehold, requireProfile)
	{
		authed.GET("/household", d.GetHousehold)
		authed.PATCH("/household", requireAdmin, d.UpdateHousehold)

		members := authed.Group("/members")
		{
			members.GET("", d.ListMembers)
			members.GET("/:id", d.GetMember)
			members.POST("", requireAdmin, d.CreateMember)
			members.PATCH("/:id", requireAdmin, d.UpdateMember)
			members.DELETE("/:id/pin", requireAdmin, d.ClearMemberPIN)
			members.DELETE("/:id", requireAdmin, d.DeleteMember)
		}

		chores := authed.Group("/chores")
		{
			chores.GET("", d.ListChores)
			chores.GET("/:id", d.GetChore)
			chores.POST("", requireAdmin, d.CreateChore)
			chores.PATCH("/:id", requireAdmin, d.UpdateChore)
			chores.DELETE("/:id", requireAdmin, d.DeleteChore)
			chores.POST("/:id/complete", d.CompleteChore)
			chores.POST("/:id/uncomplete", d.UncompleteChore)
		}

		reminders := authed.Group("/reminders")
		{
			reminders.GET("", d.ListReminders)
			reminders.POST("", d.CreateReminder)
			reminders.PATCH("/:id/toggle", d.ToggleReminderDone)
			reminders.DELETE("/:id", d.DeleteReminder)
		}

		rewards := authed.Group("/rewards")
		{
			rewards.GET("", d.ListRewards)
			rewards.POST("", requireAdmin, d.CreateReward)
			rewards.PATCH("/:id", requireAdmin, d.UpdateReward)
			rewards.PATCH("/:id/toggle", requireAdmin, d.ToggleRewardActive)
			rewards.DELETE("/:id", requireAdmin, d.DeleteReward)
			rewards.POST("/:id/redeem", d.RedeemReward)
		}
	}
}
