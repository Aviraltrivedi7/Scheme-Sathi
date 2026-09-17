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
  app.get("/manus-storage/*", async (req, res) => {
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

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
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
