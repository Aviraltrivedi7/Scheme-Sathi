// Preconfigured storage helpers for self-hosted Scheme Sathi deployments.
// Uploads via platform presigned URL to S3 (PUT direct).
// Downloads return /app-storage/{key} paths served via 307 redirect.
//
// Standalone mode (no platform config): files are stored on local disk under
// LOCAL_STORAGE_DIR (default "local-storage") and served through the same
// /app-storage/{key} proxy path, so document flows work with only Node+MySQL.

import fs from "node:fs/promises";
import path from "node:path";
import { ENV, STANDALONE_MODE } from "./_core/env";

const LOCAL_STORAGE_DIR =
  process.env.LOCAL_STORAGE_DIR ?? "local-storage";

function getPlatformConfig() {
  const platformUrl = ENV.platformApiUrl;
  const platformKey = ENV.platformApiKey;

  if (!platformUrl || !platformKey) {
    throw new Error(
      "Storage config missing: set PLATFORM_API_URL and PLATFORM_API_KEY"
    );
  }

  return { platformUrl: platformUrl.replace(/\/+$/, ""), platformKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/** Resolves a storage key to an absolute path inside LOCAL_STORAGE_DIR, rejecting traversal. */
function localKeyPath(relKey: string): string {
  const key = normalizeKey(relKey);
  const root = path.resolve(LOCAL_STORAGE_DIR);
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep))
    throw new Error("Invalid storage key");
  return target;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  if (STANDALONE_MODE) {
    const target = localKeyPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return { key, url: `/app-storage/${key}` };
  }

  const { platformUrl, platformKey } = getPlatformConfig();

  // 1. Get presigned PUT URL from the platform
  const presignUrl = new URL("v1/storage/presign/put", platformUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${platformKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Platform returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/app-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/app-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  // Standalone mode: the /app-storage proxy streams from disk, so an
  // internal path is the "signed" URL. Ownership is enforced by the DB layer
  // before any key reaches this function.
  if (STANDALONE_MODE) return `/app-storage/${normalizeKey(relKey)}`;

  const { platformUrl, platformKey } = getPlatformConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", platformUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${platformKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
