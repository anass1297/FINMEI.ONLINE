import crypto from "crypto";
import { db } from "./db";

export type TokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueToken(userId: string, type: TokenType, ttlMinutes: number) {
  await db.authToken.deleteMany({ where: { userId, type } });
  const token = randomToken();
  await db.authToken.create({
    data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return token;
}

/** Validates and consumes (deletes) a token. Returns the userId or null. */
export async function consumeToken(token: string, type: TokenType) {
  const rec = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.type !== type) return null;
  await db.authToken.delete({ where: { id: rec.id } });
  if (rec.expiresAt < new Date()) return null;
  return rec.userId;
}
