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
	requireHoH := middleware.RequireHoH()
	requireSystemAdmin := middleware.RequireSystemAdmin()

	router.GET("/api/health", d.Health)
	router.GET("/api/ws", d.WS)

	api := router.Group("/api")

	authGroup := api.Group("/auth")
	{
		authGroup.POST("/signup", d.Signup)
		authGroup.POST("/login", d.Login)
		authGroup.POST("/logout", d.Logout)
		authGroup.GET("/me", requireHousehold, d.Me)
		authGroup.POST("/forgot-password", d.ForgotPassword)
		authGroup.POST("/reset-password", d.ResetPassword)
	}

	// Invite preview/accept are public: the invitee has no session yet —
	// that's the whole point of an invite link.
	invites := api.Group("/invites")
	{
		invites.GET("/:token", d.GetInvitePreview)
		invites.POST("/:token/accept", d.AcceptInvite)
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
		authed.PATCH("/household", requireHoH, d.UpdateHousehold)

		members := authed.Group("/members")
		{
			members.GET("", d.ListMembers)
			members.GET("/:id", d.GetMember)
			members.POST("", requireHoH, d.CreateMember)
			members.PATCH("/:id", requireHoH, d.UpdateMember)
			members.PATCH("/me/credentials", d.SetOwnCredentials)
			members.PATCH("/:id/credentials", requireHoH, d.SetMemberCredentials)
			members.DELETE("/:id/pin", requireHoH, d.ClearMemberPIN)
			members.DELETE("/:id", requireHoH, d.DeleteMember)

			memberInvites := members.Group("/invites")
			memberInvites.Use(requireHoH)
			{
				memberInvites.POST("", d.CreateMemberInvite)
				memberInvites.GET("", d.ListMemberInvites)
				memberInvites.DELETE("/:id", d.RevokeMemberInvite)
			}
		}

		chores := authed.Group("/chores")
		{
			chores.GET("", d.ListChores)
			chores.GET("/:id", d.GetChore)
			chores.POST("", requireHoH, d.CreateChore)
			chores.PATCH("/:id", requireHoH, d.UpdateChore)
			chores.DELETE("/:id", requireHoH, d.DeleteChore)
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
			rewards.POST("", requireHoH, d.CreateReward)
			rewards.PATCH("/:id", requireHoH, d.UpdateReward)
			rewards.PATCH("/:id/toggle", requireHoH, d.ToggleRewardActive)
			rewards.DELETE("/:id", requireHoH, d.DeleteReward)
			rewards.POST("/:id/redeem", d.RedeemReward)
		}

		admin := authed.Group("/admin")
		admin.Use(requireSystemAdmin)
		{
			admin.GET("/notification-settings", d.GetNotificationSettings)
			admin.PUT("/notification-settings", d.UpdateNotificationSettings)
			admin.POST("/notification-settings/test", d.TestNotificationSettings)

			admin.POST("/invites", d.CreateHoHInvite)
			admin.GET("/invites", d.ListHoHInvites)
			admin.DELETE("/invites/:id", d.RevokeHoHInvite)
		}
	}
}
