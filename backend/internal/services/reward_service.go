package services

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

var ErrRewardUnavailable = errors.New("reward not available")
var ErrInsufficientPoints = errors.New("not enough points yet")

// RewardService implements reward CRUD and redemption, ported from
// src/lib/actions/rewards.ts.
type RewardService struct {
	db *gorm.DB
}

func NewRewardService(db *gorm.DB) *RewardService {
	return &RewardService{db: db}
}

func (s *RewardService) List(householdID string) ([]models.Reward, error) {
	var rewards []models.Reward
	if err := s.db.Where("household_id = ?", householdID).Order("created_at asc").Find(&rewards).Error; err != nil {
		return nil, err
	}
	return rewards, nil
}

func (s *RewardService) Get(householdID, id string) (*models.Reward, error) {
	var r models.Reward
	if err := s.db.Where("id = ? AND household_id = ?", id, householdID).First(&r).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &r, nil
}

type RewardInput struct {
	Title       string
	Description *string
	PointCost   int
}

func (s *RewardService) Create(householdID string, in RewardInput) (*models.Reward, error) {
	reward := models.Reward{
		ID:          uuid.NewString(),
		HouseholdID: householdID,
		Title:       in.Title,
		Description: in.Description,
		PointCost:   in.PointCost,
		IsActive:    true,
	}
	if err := s.db.Create(&reward).Error; err != nil {
		return nil, err
	}
	return &reward, nil
}

func (s *RewardService) Update(householdID, id string, in RewardInput) (*models.Reward, error) {
	existing, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	existing.Title = in.Title
	existing.Description = in.Description
	existing.PointCost = in.PointCost
	if err := s.db.Save(existing).Error; err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *RewardService) ToggleActive(householdID, id string) (*models.Reward, error) {
	existing, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	existing.IsActive = !existing.IsActive
	if err := s.db.Save(existing).Error; err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *RewardService) Delete(householdID, id string) error {
	return s.db.Where("id = ? AND household_id = ?", id, householdID).Delete(&models.Reward{}).Error
}

// Redeem spends a user's points on a reward, recording the redemption.
func (s *RewardService) Redeem(householdID, rewardID, userID string, userPoints int) (*models.RewardRedemption, error) {
	reward, err := s.Get(householdID, rewardID)
	if err != nil {
		return nil, err
	}
	if !reward.IsActive {
		return nil, ErrRewardUnavailable
	}
	if userPoints < reward.PointCost {
		return nil, ErrInsufficientPoints
	}

	redemption := models.RewardRedemption{
		ID:          uuid.NewString(),
		RewardID:    reward.ID,
		UserID:      userID,
		PointsSpent: reward.PointCost,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&redemption).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", userID).
			Update("points", gorm.Expr("points - ?", reward.PointCost)).Error
	})
	if err != nil {
		return nil, err
	}
	return &redemption, nil
}
