package testutil

import (
	"errors"

	"gorm.io/gorm"
)

// PoisonTable registers a GORM callback that fails every query/create/
// update/delete touching table with a synthetic error, while leaving
// every other table's queries working normally. Used to exercise a
// handler's "the DB call itself returned an unexpected error" branch —
// otherwise unreachable, since closing the whole DB connection trips
// RequireHousehold's own DB check first, before the handler under test
// is ever reached.
//
// Table-scoped, not connection-wide, because GORM resolves
// Statement.Table (from the model passed to .Model()/.Find()/etc.)
// before the "Before" callbacks run, so this only intercepts the one
// table a test cares about.
func PoisonTable(db *gorm.DB, table string) {
	fail := func(tx *gorm.DB) {
		if tx.Statement.Table == table {
			_ = tx.AddError(errors.New("testutil: injected failure for table " + table))
		}
	}
	name := "testutil:poison:" + table
	_ = db.Callback().Query().Before("gorm:query").Register(name+":query", fail)
	_ = db.Callback().Row().Before("gorm:row").Register(name+":row", fail)
	_ = db.Callback().Create().Before("gorm:create").Register(name+":create", fail)
	_ = db.Callback().Update().Before("gorm:update").Register(name+":update", fail)
	_ = db.Callback().Delete().Before("gorm:delete").Register(name+":delete", fail)
}

// PoisonTableWrites is PoisonTable narrowed to Create/Update/Delete only
// — SELECT queries against table keep working. Needed for "users" and
// "households": RequireProfile/RequireHousehold SELECT from those same
// tables on every request, so a full PoisonTable would fail the
// middleware before the handler under test is ever reached. Since the
// handler paths this exercises (CreateMember, UpdateMember,
// UpdateHousehold's Rename) are all writes, narrowing to writes-only
// still reaches the branch being tested.
func PoisonTableWrites(db *gorm.DB, table string) {
	fail := func(tx *gorm.DB) {
		if tx.Statement.Table == table {
			_ = tx.AddError(errors.New("testutil: injected failure for table " + table))
		}
	}
	name := "testutil:poison-writes:" + table
	_ = db.Callback().Create().Before("gorm:create").Register(name+":create", fail)
	_ = db.Callback().Update().Before("gorm:update").Register(name+":update", fail)
	_ = db.Callback().Delete().Before("gorm:delete").Register(name+":delete", fail)
}
