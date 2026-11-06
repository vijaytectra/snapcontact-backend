import { pgTable, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

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
  // Plan id from the server's PLANS table; amount and currency are copied from it at order time.
  plan: text("plan"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  paymentSessionId: text("payment_session_id").notNull(),
  status: text("status").$type<"ACTIVE" | "PAID" | "EXPIRED" | "FAILED">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  cashfreePaymentId: text("cashfree_payment_id"),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
}, (t) => [
  index("orders_user_status_idx").on(t.userId, t.status),
  // One Cashfree payment can activate at most one order.
  uniqueIndex("orders_cashfree_payment_id_key").on(t.cashfreePaymentId),
]);

// Every webhook delivery we handled, for audit and to ignore duplicate deliveries.
export const paymentEventsTable = pgTable("payment_events", {
  eventKey: text("event_key").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  paymentStatus: text("payment_status").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" }).notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type Verification = typeof verificationsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type PaymentEvent = typeof paymentEventsTable.$inferSelect;
