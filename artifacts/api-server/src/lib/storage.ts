import { desc, eq, sql } from 'drizzle-orm';
import { db, pool, usersTable, verificationsTable, ordersTable } from '@workspace/db';
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
export async function insertUser(user: StoredUser) {
  await db.insert(usersTable).values(user);
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
