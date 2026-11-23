import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { del, get, put } from "@vercel/blob";

/**
 * Storage abstraction. Local disk implementation; replace with S3/R2/GCS by
 * implementing the same three functions.
 */
const ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/gif",
  "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safePath(key: string) {
  if (!/^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-.]+$/.test(key)) throw new Error("Invalid storage key");
  const p = path.join(ROOT, key);
  if (!p.startsWith(ROOT)) throw new Error("Invalid storage key");
  return p;
}

export async function putFile(businessId: string, filename: string, data: Buffer) {
  const ext = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
  const key = `${businessId.replace(/[^a-zA-Z0-9_-]/g, "")}/${crypto.randomBytes(16).toString("hex")}${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, data, {
      access: "private",
      addRandomSuffix: false,
    });
    return blob.url;
  }
  const p = safePath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return key;
}

export async function getFile(key: string) {
  if (/^https?:\/\//.test(key)) {
    const blob = await get(key, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) throw new Error("File not found");
    return Buffer.from(await new Response(blob.stream).arrayBuffer());
  }
  return fs.readFile(safePath(key));
}

export async function deleteFile(key: string) {
  if (/^https?:\/\//.test(key)) {
    await del(key).catch(() => undefined);
    return;
  }
  await fs.unlink(safePath(key)).catch(() => undefined);
}
