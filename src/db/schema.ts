import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
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
  // Set for household members who can log in remotely (typically parents).
  // Kid profiles are switched into locally and may only have a PIN.
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
