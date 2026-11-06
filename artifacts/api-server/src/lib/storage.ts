import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import { db, pool, usersTable, verificationsTable, ordersTable, paymentEventsTable, pendingRegistrationsTable } from '@workspace/db';
import { activatePlan, describeSubscription, type Plan, type PlanId } from './subscription';
import { normalizeUsername } from './username';
import type { RegistrationRow } from './signupFlow';
import type { User, Verification, Order } from '@workspace/db';

export type StoredUser = User;
export type StoredVerification = Verification;
export type StoredOrder = Order;

// Creates the tables on startup so a fresh database (e.g. a new Neon project) works without a migration step.
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      password_hash text NOT NULL,
      salt text NOT NULL,
      created_at timestamptz NOT NULL,
      verified boolean NOT NULL DEFAULT false,
      refresh_token text,
      subscription jsonb
    );
    CREATE TABLE IF NOT EXISTS verifications (
      email text PRIMARY KEY,
      otp_hash text NOT NULL,
      salt text NOT NULL,
      expires_at timestamptz NOT NULL,
      magic_token text
    );
    CREATE TABLE IF NOT EXISTS orders (
      order_id text PRIMARY KEY,
      user_id text NOT NULL,
      amount integer NOT NULL,
      currency text NOT NULL,
      payment_session_id text NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL,
      cashfree_payment_id text
    );
    -- Payments hardening (safe to run repeatedly on existing databases).
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS plan text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
    CREATE INDEX IF NOT EXISTS orders_user_status_idx ON orders (user_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS orders_cashfree_payment_id_key ON orders (cashfree_payment_id);
    CREATE TABLE IF NOT EXISTS payment_events (
      event_key text PRIMARY KEY,
      order_id text NOT NULL,
      type text NOT NULL,
      payment_status text NOT NULL,
      received_at timestamptz NOT NULL
    );
    -- Username sign-up (safe to run repeatedly on existing databases).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id text PRIMARY KEY,
      username text NOT NULL,
      password_hash text NOT NULL,
      salt text NOT NULL,
      password_sealed text,
      email text,
      otp_hash text,
      otp_salt text,
      otp_expires_at timestamptz,
      otp_attempts integer NOT NULL DEFAULT 0,
      code_sent_at timestamptz,
      status text NOT NULL,
      user_id text,
      created_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_username_key ON pending_registrations (username);
  `);
}

const lower = (email: string) => email.trim().toLowerCase();

export async function listUsers() {
  return db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
}
export async function findUserByEmail(email: string) {
  const [u] = await db.select().from(usersTable).where(sql`lower(${usersTable.email}) = ${lower(email)}`);
  return u;
}
export async function findUserById(id: string) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return u;
}
export async function findUserByUsername(username: string) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.username, normalizeUsername(username)));
  return u;
}
export async function insertUser(user: StoredUser) {
  await db.insert(usersTable).values(user);
}

// Username sign-up: see signupFlow.ts for what each call is for.
export async function findRegistration(id: string) {
  const [r] = await db.select().from(pendingRegistrationsTable).where(eq(pendingRegistrationsTable.id, id));
  return r;
}
export async function findRegistrationByUsername(username: string) {
  const [r] = await db.select().from(pendingRegistrationsTable).where(eq(pendingRegistrationsTable.username, normalizeUsername(username)));
  return r;
}
export async function createRegistration(row: RegistrationRow) {
  await db.insert(pendingRegistrationsTable).values(row);
}
export async function updateRegistration(id: string, patch: Partial<RegistrationRow>) {
  await db.update(pendingRegistrationsTable).set(patch).where(eq(pendingRegistrationsTable.id, id));
}
export async function incrementOtpAttempts(id: string): Promise<number> {
  const [row] = await db.update(pendingRegistrationsTable)
    .set({ otpAttempts: sql`${pendingRegistrationsTable.otpAttempts} + 1` })
    .where(eq(pendingRegistrationsTable.id, id))
    .returning({ attempts: pendingRegistrationsTable.otpAttempts });
  return row?.attempts ?? 0;
}
export async function consumeOtp(id: string, otpHash: string): Promise<boolean> {
  const rows = await db.update(pendingRegistrationsTable)
    .set({ otpHash: null, otpSalt: null, otpExpiresAt: null })
    .where(and(
      eq(pendingRegistrationsTable.id, id),
      eq(pendingRegistrationsTable.otpHash, otpHash),
      eq(pendingRegistrationsTable.status, 'AWAITING_CODE'),
    ))
    .returning({ id: pendingRegistrationsTable.id });
  return rows.length > 0;
}
export async function activateRegistration(id: string, user: StoredUser) {
  await db.transaction(async (tx) => {
    await tx.insert(usersTable).values(user);
    await tx.update(pendingRegistrationsTable)
      .set({ status: 'VERIFIED', userId: user.id })
      .where(eq(pendingRegistrationsTable.id, id));
  });
}
export async function deleteRegistration(id: string) {
  await db.delete(pendingRegistrationsTable).where(eq(pendingRegistrationsTable.id, id));
}
export async function deleteExpiredRegistrations(nowIso: string) {
  await db.delete(pendingRegistrationsTable).where(lt(pendingRegistrationsTable.expiresAt, nowIso));
}
export async function updateUser(id: string, patch: Partial<StoredUser>) {
  await db.update(usersTable).set(patch).where(eq(usersTable.id, id));
}

// Verifications are keyed by lower-cased email: one pending code per address.
export async function saveVerification(v: StoredVerification) {
  const row = { ...v, email: lower(v.email) };
  await db.insert(verificationsTable).values(row).onConflictDoUpdate({ target: verificationsTable.email, set: row });
}
export async function findVerification(email: string) {
  const [v] = await db.select().from(verificationsTable).where(eq(verificationsTable.email, lower(email)));
  return v;
}
export async function deleteVerification(email: string) {
  await db.delete(verificationsTable).where(eq(verificationsTable.email, lower(email)));
}

export async function listOrders() {
  return db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
}
export async function insertOrder(order: StoredOrder) {
  await db.insert(ordersTable).values(order);
}
export async function findOrderById(id: string) {
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, id));
  return o;
}
export async function updateOrder(id: string, patch: Partial<StoredOrder>) {
  await db.update(ordersTable).set(patch).where(eq(ordersTable.orderId, id));
}

/** Newest unpaid order of this plan for the user, if any. */
export async function findOpenOrder(userId: string, plan: PlanId) {
  const [o] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.plan, plan), eq(ordersTable.status, 'ACTIVE')))
    .orderBy(desc(ordersTable.createdAt)).limit(1);
  return o;
}

export async function setOrderStatus(orderId: string, status: 'EXPIRED' | 'FAILED') {
  await db.update(ordersTable).set({ status }).where(and(eq(ordersTable.orderId, orderId), ne(ordersTable.status, 'PAID')));
}

/**
 * Marks the order PAID and extends the owner's plan in one transaction. The conditional
 * update only matches an unpaid order, so concurrent webhook + app checks activate once.
 */
export async function activatePaidOrder(orderId: string, paymentId: string, plan: Plan, now: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx.update(ordersTable)
      .set({ status: 'PAID', cashfreePaymentId: paymentId, paidAt: new Date(now).toISOString() })
      .where(and(eq(ordersTable.orderId, orderId), ne(ordersTable.status, 'PAID')))
      .returning();
    if (!order) return false;
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, order.userId)).for('update');
    if (!user) throw new Error(`Paid order ${orderId} has no user`);
    await tx.update(usersTable)
      .set({ subscription: activatePlan(user.subscription, plan, orderId, paymentId, now) })
      .where(eq(usersTable.id, user.id));
    return true;
  });
}

export async function recordPaymentEvent(eventKey: string, orderId: string, type: string, paymentStatus: string) {
  const rows = await db.insert(paymentEventsTable)
    .values({ eventKey, orderId, type, paymentStatus, receivedAt: new Date().toISOString() })
    .onConflictDoNothing().returning();
  return rows.length > 0;
}

export async function hasActivePlan(userId: string, now: number) {
  const user = await findUserById(userId);
  return !!user && describeSubscription(user.subscription, user.createdAt, now).status === 'annual';
}
