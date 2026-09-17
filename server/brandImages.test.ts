import { existsSync, readFileSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the three brand images the homepage, PWA manifest, and iOS home
 * screen rely on. They used to live at /manus-storage/* (platform storage)
 * and silently 404'd on every other deployment — now they are static client
 * assets, and this test fails the build if one goes missing again.
 */
const root = join(__dirname, "..");
const imagePath = (name: string) => join(root, "client", "public", "images", name);
const distPath = (name: string) => join(root, "dist", "public", "images", name);

/**
 * Minimal PNG decoder for RGBA, non-interlaced images — enough to read raw
 * pixels for palette/alpha assertions without a dependency. Only handles the
 * color-type 6 files gen-images.py emits.
 */
function decodePngRgba(buf: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) expect(view.getUint8(i)).toBe(sig[i]);
  let offset = 8;
  let width = 0, height = 0;
  const idat: Uint8Array[] = [];
  let colorType = -1;
  let bitDepth = -1;
  let interlace = -1;
  while (offset < buf.length) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7),
    );
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      bitDepth = view.getUint8(offset + 16);
      colorType = view.getUint8(offset + 17);
      interlace = view.getUint8(offset + 20);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + len;
  }
  expect(colorType, "expected a truecolor-alpha PNG").toBe(6);
  expect(bitDepth).toBe(8);
  expect(interlace).toBe(0);
  const raw = inflateSync(Buffer.concat(idat.map(x => Buffer.from(x))));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgba = new Uint8Array(width * height * 4);
  let pos = 0;
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    line.set(raw.subarray(pos, pos + stride)); pos += stride;
    // PNG filters (unfilter in place)
    if (filter === 1) {
      for (let x = bytesPerPixel; x < stride; x++) line[x] = (line[x] + line[x - bytesPerPixel]) & 0xff;
    } else if (filter === 2) {
      for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 0xff;
    } else if (filter === 3) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0;
        line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xff;
      }
    } else if (filter === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bytesPerPixel ? line[x - bytesPerPixel] : 0;
        const b = prev[x];
        const c = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[x] = (line[x] + pr) & 0xff;
      }
    }
    rgba.set(line, y * stride);
    prev.set(line);
  }
  return { width, height, rgba };
}

describe("brand images ship with the app", () => {
  const files = [
    { name: "scheme-sathi-mark.png", minBytes: 400, minWidth: 96 },
    { name: "scheme-sathi-hero.png", minBytes: 20_000, minWidth: 480 },
    { name: "scheme-sathi-pwa-icon.png", minBytes: 2_000, minWidth: 480 },
  ];

  it.each(files)("client/public/images/$name exists and is a real PNG", ({ name, minBytes }) => {
    const p = imagePath(name);
    expect(existsSync(p), `${name} missing from client/public/images`).toBe(true);
    expect(statSync(p).size, `${name} is suspiciously small`).toBeGreaterThan(minBytes);
    // PNG magic number
    const header = readFileSync(p).subarray(0, 8);
    expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("no HTML reference points back at the old /manus-storage/ asset URLs", () => {
    const home = readFileSync(join(root, "client", "src", "pages", "Home.tsx"), "utf8");
    expect(home).not.toContain("/manus-storage/scheme-sathi-");
    expect(home).toContain("/images/scheme-sathi-mark.png");
    expect(home).toContain("/images/scheme-sathi-hero.png");

    const manifest = JSON.parse(
      readFileSync(join(root, "client", "public", "manifest.webmanifest"), "utf8")
    );
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toContain(
      "/images/scheme-sathi-pwa-icon.png"
    );

    const indexHtml = readFileSync(join(root, "client", "index.html"), "utf8");
    expect(indexHtml).not.toContain("/manus-storage/scheme-sathi-");
  });

  it("the built bundle contains the images (dist/public/images)", () => {
    for (const { name } of files) {
      const p = distPath(name);
      expect(existsSync(p), `${name} missing from dist/public/images — run pnpm build`).toBe(true);
    }
  });

  it("the generator palette matches the page's CSS tokens exactly", () => {
    // The hero used to look pasted-on because its colors drifted from the
    // page tokens (brown ink vs indigo ink, different saffron/emerald/cream).
    // This contract parses BOTH files, so a token change in index.css fails
    // CI until gen-images.py is regenerated.
    const gen = readFileSync(join(root, "gen-images.py"), "utf8");
    const css = readFileSync(join(root, "client", "src", "index.css"), "utf8");

    const token = (name: string) => {
      const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`));
      if (!m) throw new Error(`CSS token --${name} not found`);
      return m[1].toLowerCase();
    };
    const tokenRgb = (name: string) =>
      (token(name).match(/../g) ?? []).map(h => parseInt(h, 16));

    // Generator tuples are "R, G, B, 255" — pair each with its CSS var.
    const pairs: Array<[string, string]> = [
      ["PAPER = (247, 243, 235, 255)", "paper"],
      ["SAFFRON = (217, 130, 43, 255)", "saffron"],
      ["SAFFRON_DEEP = (184, 101, 30, 255)", "saffron-deep"],
      ["EMERALD = (42, 133, 107, 255)", "emerald"],
      ["CORAL = (198, 90, 74, 255)", "coral"],
      ["INK = (31, 46, 73, 255)", "ink"],
      ["LINE = (221, 214, 200, 255)", "line"],
      ["WHITE = (255, 253, 249, 255)", "white"],
    ];
    for (const [literal, cssName] of pairs) {
      expect(gen, `gen-images.py lost the exact ${cssName} literal`).toContain(literal);
      const genRgb = literal.match(/\((\d+), (\d+), (\d+), 255\)/)!.slice(1, 4).map(Number);
      expect(genRgb, `--${cssName} CSS token drifted from the generator`).toEqual(tokenRgb(cssName));
    }
  });

  it("the hero has a transparent background so it blends into the page blob", () => {
    // .hero-art uses mix-blend-mode: multiply over a paper-deep organic
    // blob — a solid background square inside the art would show as a
    // visible tile that never aligns with the blob edge.
    const { width, height, rgba } = decodePngRgba(
      new Uint8Array(readFileSync(imagePath("scheme-sathi-hero.png")))
    );
    expect(width).toBeGreaterThanOrEqual(600);
    expect(rgba[3]).toBe(0);           // top-left corner transparent
    const topRight = (width - 1) * 4 + 3;
    expect(rgba[topRight]).toBe(0);    // top-right corner transparent
    // And the artwork still covers a real share of the frame.
    let opaque = 0, sampled = 0;
    for (let i = 0; i < width * height; i += 101) {
      sampled++;
      if (rgba[i * 4 + 3] > 200) opaque++;
    }
    expect(opaque / sampled).toBeGreaterThan(0.15);
    // Palette parity inside the PNG itself: the art must actually paint with
    // the page's ink token somewhere (hair, outlines, type). Coordinates are
    // not pinned — the composition changed once already and broke a hardcoded
    // sample point, so we scan instead.
    let inkPixels = 0;
    for (let i = 0; i < width * height; i += 7) {
      const a = rgba[i * 4 + 3];
      if (a > 200) {
        const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
        if (Math.abs(r - 31) <= 2 && Math.abs(g - 46) <= 2 && Math.abs(b - 73) <= 2) {
          inkPixels++;
        }
      }
    }
    expect(inkPixels, "hero should contain the page's ink token").toBeGreaterThan(100);
  });
});
