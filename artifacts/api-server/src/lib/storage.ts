import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file: string): any[] {
  ensureDir();
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function writeJson(file: string, data: any[]) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  verified: boolean;
  refreshToken?: string;
  subscription: any;
};

export function getUsers(): StoredUser[] { return readJson(USERS_FILE); }
export function saveUsers(users: StoredUser[]) { writeJson(USERS_FILE, users); }
export function findUserByEmail(email: string) { return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()); }
export function findUserById(id: string) { return getUsers().find(u => u.id === id); }

export type StoredVerification = {
  email: string;
  otpHash: string;
  salt: string;
  expiresAt: string;
  magicToken?: string;
};

const VERIFICATIONS_FILE = path.join(DATA_DIR, 'verifications.json');
export function getVerifications(): StoredVerification[] { return readJson(VERIFICATIONS_FILE); }
export function saveVerifications(v: StoredVerification[]) { writeJson(VERIFICATIONS_FILE, v); }

export type StoredOrder = {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentSessionId: string;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED';
  createdAt: string;
  cashfreePaymentId?: string;
};

export function getOrders(): StoredOrder[] { return readJson(ORDERS_FILE); }
export function saveOrders(orders: StoredOrder[]) { writeJson(ORDERS_FILE, orders); }
export function findOrderById(id: string) { return getOrders().find(o => o.orderId === id); }
