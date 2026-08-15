package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

func (d *Deps) ListRewards(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	rewards, err := d.Reward.List(household.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list rewards"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rewards": rewards})
}

type rewardRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	PointCost   int     `json:"pointCost"`
}

func (r *rewardRequest) toInput() (services.RewardInput, string) {
	if r.Title == "" {
		return services.RewardInput{}, "title is required"
	}
	if r.PointCost <= 0 {
		return services.RewardInput{}, "point cost must be a positive number"
	}
	return services.RewardInput{Title: r.Title, Description: r.Description, PointCost: r.PointCost}, ""
}

func (d *Deps) CreateReward(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req rewardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	input, errMsg := req.toInput()
	if errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	reward, err := d.Reward.Create(household.ID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create reward"})
		return
	}
	c.JSON(http.StatusCreated, reward)
}

func (d *Deps) UpdateReward(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req rewardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	input, errMsg := req.toInput()
	if errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	reward, err := d.Reward.Update(household.ID, c.Param("id"), input)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "reward not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update reward"})
		return
	}
	c.JSON(http.StatusOK, reward)
}

func (d *Deps) ToggleRewardActive(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	reward, err := d.Reward.ToggleActive(household.ID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "reward not found"})
		return
	}
	c.JSON(http.StatusOK, reward)
}

func (d *Deps) DeleteReward(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	if err := d.Reward.Delete(household.ID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete reward"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (d *Deps) RedeemReward(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user := middleware.CurrentUser(c)
	rewardID := c.Param("id")

	redemption, err := d.Reward.Redeem(household.ID, rewardID, user.ID, user.Points)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound), errors.Is(err, services.ErrRewardUnavailable):
			c.JSON(http.StatusBadRequest, gin.H{"error": "reward not available"})
		case errors.Is(err, services.ErrInsufficientPoints):
			c.JSON(http.StatusBadRequest, gin.H{"error": "not enough points yet"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to redeem reward"})
		}
		return
	}

	d.broadcastEvent("reward.redeemed", map[string]any{"rewardId": rewardID, "userId": user.ID})
	c.JSON(http.StatusOK, redemption)
}
