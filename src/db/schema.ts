import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Applies to the whole household (a shared kiosk screen isn't
  // per-browser), not just the account that changes it.
  themePreference: text("theme_preference", {
    enum: ["system", "light", "dark"],
  })
    .notNull()
    .default("system"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarEmoji: text("avatar_emoji").notNull().default("🙂"),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  // Only the household's one main account (created at signup) has
  // email/passwordHash — that's the single login the whole household
  // shares. Every other profile (additional parents or kids) is switched
  // into locally via the avatar picker; pinHash gates switching into any
  // "admin" role profile so a kid can't tap into edit powers.
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  pinHash: text("pin_hash"),
  points: integer("points").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const chores = sqliteTable("chores", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  points: integer("points").notNull().default(0),
  // For "none" (one-time chores), the date it's due. For recurring chores,
  // the date recurrence starts from — a weekly chore due Wednesdays is
  // anchored by dueDate falling on a Wednesday. Defaults to creation date.
  dueDate: integer("due_date", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  // "custom" uses recurrenceDays to hold a JSON array of weekday ints (0=Sun..6=Sat).
  recurrence: text("recurrence", {
    enum: ["none", "daily", "weekly", "weekdays", "custom"],
  })
    .notNull()
    .default("none"),
  recurrenceDays: text("recurrence_days"),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const choreCompletions = sqliteTable("chore_completions", {
  id: text("id").primaryKey(),
  choreId: text("chore_id")
    .notNull()
    .references(() => chores.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  completedAt: integer("completed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  pointsAwarded: integer("points_awarded").notNull().default(0),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  // Unassigned reminders are visible to the whole household (e.g. "trash
  // day is Thursday"), not just whoever created them.
  assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  notes: text("notes"),
  dueAt: integer("due_at", { mode: "timestamp" }),
  isDone: integer("is_done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const rewards = sqliteTable("rewards", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  pointCost: integer("point_cost").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const rewardRedemptions = sqliteTable("reward_redemptions", {
  id: text("id").primaryKey(),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pointsSpent: integer("points_spent").notNull(),
  redeemedAt: integer("redeemed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
