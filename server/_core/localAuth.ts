import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { localCredentials, users, type User } from "../../drizzle/schema";
import * as db from "../db";
import { STANDALONE_ADMIN_EMAIL, sessionSecret } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { consumeRateLimit } from "./rateLimit";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const ONE_YEAR_MS = ONE_YEAR_SECONDS * 1000;

/** openId namespace for standalone accounts so they can never collide with platform OAuth subjects. */
const standaloneOpenId = (email: string) => `local:${email.toLowerCase()}`;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const derived = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(derived, expected)
  );
}

/** Mint the same HS256 session JWT the platform SDK issues, so tRPC auth needs no branching. */
async function issueSessionCookie(user: User, req: Request, res: Response) {
  const token = await new SignJWT({
    openId: user.openId,
    appId: "scheme-sathi-local",
    name: user.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS)
    .sign(new TextEncoder().encode(sessionSecret()));

  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

type RegisterInput = { name: string; email: string; password: string };

/** Register: generous IP cap, small per-email cap (prevents enumeration spam). */
const REGISTER_LIMIT = { name: "auth-register", windowMs: 60 * 60_000, max: 20 };
/** Login: tight per-email+IP caps so password guessing is impractical. */
const LOGIN_LIMIT = { name: "auth-login", windowMs: 15 * 60_000, max: 10 };

const WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "abcdefgh",
  "abcd1234",
  "letmein1",
  "welcome1",
  "admin123",
  "admin1234",
  "iloveyou",
  "monkey123",
  "dragon123",
  "sunshine",
  "princess",
  "football",
  "scheme123",
  "schemesathi",
]);

export function isWeakPassword(password: string): boolean {
  return WEAK_PASSWORDS.has(password.trim().toLowerCase());
}

/** Uniform 429 responses so limits never leak which rule fired. */
function tooManyAttempts(res: Response) {
  res.status(429).json({
    error: "Too many attempts. Please wait a few minutes before trying again.",
  });
}

export function validateCredentialInput(
  input: unknown
): input is RegisterInput {
  if (!input || typeof input !== "object") return false;
  const { name, email, password } = input as Record<string, unknown>;
  return (
    typeof name === "string" &&
    name.trim().length >= 2 &&
    name.trim().length <= 120 &&
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    email.length <= 320 &&
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128 &&
    !isWeakPassword(password)
  );
}

async function createStandaloneUser(input: RegisterInput): Promise<User> {
  const dbh = await db.getDb();
  if (!dbh) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();
  const openId = standaloneOpenId(email);

  const existingCredential = await dbh
    .select({ id: localCredentials.id })
    .from(localCredentials)
    .where(eq(localCredentials.email, email))
    .limit(1);
  if (existingCredential[0])
    throw new Error("An account with this email already exists. Try signing in.");

  const existingUser = await dbh
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  if (existingUser[0])
    throw new Error("An account with this email already exists. Try signing in.");

  // First registered account becomes admin when STANDALONE_ADMIN_EMAIL is
  // unset; a configured email is promoted when it registers.
  const anyUser = await dbh.select({ id: users.id }).from(users).limit(1);
  const shouldPromoteAdmin = STANDALONE_ADMIN_EMAIL
    ? STANDALONE_ADMIN_EMAIL === email
    : !anyUser[0];

  await db.upsertUser({
    openId,
    name: input.name.trim(),
    email,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  if (shouldPromoteAdmin) {
    await dbh
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.openId, openId));
  }

  const passwordHash = await hashPassword(input.password);
  await dbh.insert(localCredentials).values({ openId, email, passwordHash });

  const rows = await dbh
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  const user = rows[0];
  if (!user) throw new Error("Account creation failed");
  return user;
}

async function authenticateStandaloneUser(
  email: string,
  password: string
): Promise<User> {
  const dbh = await db.getDb();
  if (!dbh) throw new Error("Database is not available");
  const normalized = email.trim().toLowerCase();
  const rows = await dbh
    .select()
    .from(localCredentials)
    .where(eq(localCredentials.email, normalized))
    .limit(1);
  const credential = rows[0];
  // Uniform error: never reveal whether the email exists.
  if (!credential || !(await verifyPassword(password, credential.passwordHash)))
    throw new Error("Email or password is incorrect.");
  const userRows = await dbh
    .select()
    .from(users)
    .where(eq(users.openId, credential.openId))
    .limit(1);
  const user = userRows[0];
  if (!user) throw new Error("Email or password is incorrect.");
  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return user;
}

export function registerLocalAuthRoutes(app: Express) {
  const json = (res: Response, status: number, body: Record<string, unknown>) =>
    res.status(status).json(body);

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    if (
      !consumeRateLimit(REGISTER_LIMIT, [
        `ip:${req.ip ?? "unknown"}`,
        `email:${email.toLowerCase()}`,
      ])
    )
      return tooManyAttempts(res);
    if (!validateCredentialInput(req.body))
      return json(res, 400, {
        error:
          "Enter a name (2+ characters), a valid email, and a stronger password of at least 8 characters.",
      });
    try {
      const user = await createStandaloneUser(req.body);
      await issueSessionCookie(user, req, res);
      return json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      const message = (error as Error).message;
      // Without MySQL, sign-up can't persist — say so plainly and point
      // explorers back to the public pages that work without an account.
      if (message.includes("Database is not available"))
        return json(res, 503, { error: "Accounts need the database. Public discovery still works — start MySQL (pnpm db:push) and try again." });
      return json(res, 400, { error: message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string" || !email || !password)
      return json(res, 400, { error: "Enter your email and password." });
    if (
      !consumeRateLimit(LOGIN_LIMIT, [
        `ip:${req.ip ?? "unknown"}`,
        `email:${email.trim().toLowerCase()}`,
      ])
    )
      return tooManyAttempts(res);
    try {
      const user = await authenticateStandaloneUser(email, password);
      await issueSessionCookie(user, req, res);
      return json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("Database is not available"))
        return json(res, 503, { error: "Accounts need the database. Public discovery still works — start MySQL (pnpm db:push) and try again." });
      return json(res, 401, { error: message });
    }
  });
}
