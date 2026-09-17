import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const sessionLifetimeSeconds = 60 * 60 * 8;
const sessionSecret = process.env.SESSION_SECRET || 'selamate-development-secret-change-in-production';
const configuredUsers = [
  { id: 'admin-1', name: 'Admin Selamate', email: process.env.ADMIN_EMAIL || 'admin@selamate.id', password: process.env.ADMIN_PASSWORD || 'Admin123!', role: 'Admin' },
  { id: 'user-1', name: 'Pengguna Selamate', email: process.env.USER_EMAIL || 'user@selamate.id', password: process.env.USER_PASSWORD || 'User123!', role: 'User' },
];
let usersPromise;

async function loadUsers() {
  if (!usersPromise) usersPromise = Promise.all(configuredUsers.map(async ({ password, ...user }) => {
    const salt = randomBytes(16);
    return { ...user, salt, hash: await scrypt(password, salt, 64) };
  }));
  return usersPromise;
}
const encode = value => Buffer.from(value).toString('base64url');
const sign = payload => createHmac('sha256', sessionSecret).update(payload).digest('base64url');
export const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });

export async function authenticate(email, password) {
  const user = (await loadUsers()).find(candidate => candidate.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || typeof password !== 'string') return null;
  const candidate = await scrypt(password, user.salt, 64);
  return timingSafeEqual(user.hash, candidate) ? publicUser(user) : null;
}
export function createSession(user) {
  const payload = encode(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds }));
  return `${payload}.${sign(payload)}`;
}
export async function getSessionUser(request) {
  const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('selamate_session='));
  const [payload, signature] = (cookie?.slice('selamate_session='.length) || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    const user = (await loadUsers()).find(candidate => candidate.id === session.sub);
    return user ? publicUser(user) : null;
  } catch { return null; }
}
export const sessionCookie = (token, secure = false) => `selamate_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${sessionLifetimeSeconds}${secure ? '; Secure' : ''}`;
export const expiredSessionCookie = () => 'selamate_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0';
