import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("installable Scheme Sathi PWA", () => {
  it("ships a standalone v1 manifest with a persistent Scheme Sathi icon", () => {
    const manifest = JSON.parse(read("client/public/manifest.webmanifest"));
    expect(manifest).toEqual(expect.objectContaining({
      name: "Scheme Sathi — Government schemes, made clear.",
      short_name: "Scheme Sathi",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#f7f3eb",
    }));
    expect(manifest.icons).toEqual([expect.objectContaining({
      src: "/images/scheme-sathi-pwa-icon.png",
      type: "image/png",
      purpose: "any maskable",
    })]);
  });

  it("registers a safe shell worker with an offline navigation fallback", () => {
    const main = read("client/src/main.tsx");
    const worker = read("client/public/sw.js");
    const offlinePage = read("client/public/offline.html");
    expect(main).toContain('navigator.serviceWorker.register(workerUrl)');
    expect(main).toContain('import.meta.env.DEV ? "/sw.js?dev=1" : "/sw.js"');
    expect(worker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(worker).toContain('event.request.mode === "navigate"');
    expect(worker).toContain('caches.match(OFFLINE_URL)');
    expect(worker).toContain('requestUrl.pathname.startsWith("/api/")');
    expect(offlinePage).toContain("You’re offline");
  });

  it("announces waiting worker updates and lets the user opt into a safe refresh", () => {
    const main = read("client/src/main.tsx");
    const worker = read("client/public/sw.js");
    const app = read("client/src/App.tsx");
    const prompt = read("client/src/components/PwaUpdatePrompt.tsx");
    expect(main).toContain('scheme-sathi-update-ready');
    expect(main).toContain('registration.addEventListener("updatefound"');
    expect(worker).toContain('const CACHE_NAME = "scheme-sathi-shell-v2"');
    expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
    expect(app).toContain("<PwaUpdatePrompt />");
    expect(prompt).toContain('registration.waiting?.postMessage({ type: "SKIP_WAITING" })');
    expect(prompt).toContain('controllerchange');
    expect(prompt).toContain("Update available");
  });

  it("wires a right-side install CTA with prompt, iOS guidance, and installed feedback", () => {
    const html = read("client/index.html");
    const home = read("client/src/pages/Home.tsx");
    const installButton = read("client/src/components/PwaInstallButton.tsx");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(home).toContain('<PwaInstallButton language={language} />');
    expect(installButton).toContain('beforeinstallprompt');
    expect(installButton).toContain('deferredPrompt.prompt()');
    expect(installButton).toContain('appinstalled');
    expect(installButton).toContain('Add to Home Screen');
    expect(installButton).toContain('Install app');
    expect(installButton).toContain('Installed');
  });
});
