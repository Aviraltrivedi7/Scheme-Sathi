import fs from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";
import { ENV, STANDALONE_MODE } from "./env";

const LOCAL_STORAGE_DIR =
  process.env.LOCAL_STORAGE_DIR ?? "local-storage";

/** Resolves a storage key to an absolute path inside LOCAL_STORAGE_DIR, rejecting traversal. */
function localKeyPath(key: string): string {
  const root = path.resolve(LOCAL_STORAGE_DIR);
  const target = path.resolve(root, key.replace(/^\/+/, ""));
  if (target !== root && !target.startsWith(root + path.sep))
    throw new Error("Invalid storage key");
  return target;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function registerStorageProxy(app: Express) {
  app.get("/app-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Standalone mode: stream the file from local disk. Access control is
    // enforced by the domain layer before any key is handed to the browser;
    // keys carry an unguessable random suffix.
    if (STANDALONE_MODE) {
      try {
        const target = localKeyPath(key);
        const data = await fs.readFile(target);
        const contentType =
          MIME_BY_EXTENSION[path.extname(target).toLowerCase()] ??
          "application/octet-stream";
        res.set("Cache-Control", "no-store");
        res.type(contentType);
        res.send(data);
      } catch {
        res.status(404).send("File not found");
      }
      return;
    }

    if (!ENV.platformApiUrl || !ENV.platformApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const platformUrl = new URL(
        "v1/storage/presign/get",
        ENV.platformApiUrl.replace(/\/+$/, "") + "/",
      );
      platformUrl.searchParams.set("path", key);

      const platformResp = await fetch(platformUrl, {
        headers: { Authorization: `Bearer ${ENV.platformApiKey}` },
      });

      if (!platformResp.ok) {
        const body = await platformResp.text().catch(() => "");
        console.error(`[StorageProxy] platform error: ${platformResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await platformResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
