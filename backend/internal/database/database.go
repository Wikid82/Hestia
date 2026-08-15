// Package database opens the GORM/SQLite connection and runs
// auto-migrations. Uses the pure-Go, cgo-free glebarez/sqlite driver so
// Docker builds stay easy on ARM (Raspberry Pi / NAS).
package database

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"hestia/backend/internal/models"
)

// Open opens the SQLite database at path (creating parent directories as
// needed), applies WAL-mode pragmas for concurrent read/write safety, and
// runs GORM AutoMigrate against all known models.
func Open(path string) (*gorm.DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("creating db directory: %w", err)
		}
	}

	dsn := fmt.Sprintf(
		"%s?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_cache_size=-64000",
		path,
	)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	if err := db.AutoMigrate(
		&models.Household{},
		&models.User{},
		&models.Chore{},
		&models.ChoreCompletion{},
		&models.Reminder{},
		&models.Reward{},
		&models.RewardRedemption{},
	); err != nil {
		return nil, fmt.Errorf("running auto-migration: %w", err)
	}

	return db, nil
}
