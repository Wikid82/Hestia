package services

import (
	"errors"

	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

type HouseholdService struct {
	db *gorm.DB
}

func NewHouseholdService(db *gorm.DB) *HouseholdService {
	return &HouseholdService{db: db}
}

func (s *HouseholdService) Get(id string) (*models.Household, error) {
	var h models.Household
	if err := s.db.Where("id = ?", id).First(&h).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &h, nil
}

func (s *HouseholdService) Rename(id, name string) (*models.Household, error) {
	if err := s.db.Model(&models.Household{}).Where("id = ?", id).Update("name", name).Error; err != nil {
		return nil, err
	}
	return s.Get(id)
}

var validThemes = map[string]bool{"system": true, "light": true, "dark": true}

func (s *HouseholdService) UpdateTheme(id, theme string) (*models.Household, error) {
	if !validThemes[theme] {
		return nil, errors.New("invalid theme preference")
	}
	if err := s.db.Model(&models.Household{}).Where("id = ?", id).Update("theme_preference", theme).Error; err != nil {
		return nil, err
	}
	return s.Get(id)
}
