import { pgTable, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  verified: boolean("verified").notNull().default(false),
  refreshToken: text("refresh_token"),
  subscription: jsonb("subscription"),
});

// One pending OTP / magic link per email address.
export const verificationsTable = pgTable("verifications", {
  email: text("email").primaryKey(),
  otpHash: text("otp_hash").notNull(),
  salt: text("salt").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  magicToken: text("magic_token"),
});

export const ordersTable = pgTable("orders", {
  orderId: text("order_id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  paymentSessionId: text("payment_session_id").notNull(),
  status: text("status").$type<"ACTIVE" | "PAID" | "EXPIRED">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  cashfreePaymentId: text("cashfree_payment_id"),
});

export type User = typeof usersTable.$inferSelect;
export type Verification = typeof verificationsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
