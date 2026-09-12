import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Image SEO and image performance, enforced on the source.
 * ══════════════════════════════════════════════════════════════════
 * Two content illustrations used to be hotlinked from
 * images.unsplash.com with a photo id for a filename and a title-case
 * alt ("Human Brain Visualization"). That is three separate losses at
 * once:
 *
 *   • the image search credit, the caching and the format negotiation
 *     all belonged to a CDN we do not control — and a deleted photo
 *     would have left a hole in the layout with no build error;
 *   • an alt of "Human Brain Visualization" describes a search query,
 *     not what is on the page, so it neither helps a screen reader nor
 *     ranks the image;
 *   • a multi-megabyte PNG sitting behind a CDN query string is not a
 *     delivery format, it is an accident.
 *
 * The rules below are the ones the self-hosted replacements follow.
 * They are checked here (on every component) and over the emitted HTML
 * by gate 13 in scripts/seo-validate.mjs, because a stray `<img>` in a
 * new page fails silently otherwise.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "src");
const PUBLIC = path.join(here, "..", "public");

/** Component files, recursively. */
function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".test.tsx") || entry.endsWith(".test.ts")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

interface ImgTag {
  file: string;
  attrs: string;
  src: string | null;
  alt: string | null;
}

/**
 * Comments out, first: a prose mention of `<img>` inside a doc comment is not a
 * tag, and a `//` line inside a JSX attribute list is not an attribute.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function imgTags(): ImgTag[] {
  const found: ImgTag[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const tag = /<img\b([\s\S]*?)\/>/g;
    let m: RegExpExecArray | null;
    while ((m = tag.exec(source))) {
      const attrs = m[1]!;
      const src = /\bsrc=\{?"?([^"\s}]*)"?\}?/.exec(attrs)?.[1] ?? null;
      const alt = /\balt="([^"]*)"/.exec(attrs)?.[1] ?? (/\balt=\{/.test(attrs) ? "" : null);
      found.push({ file: path.relative(SRC, file), attrs, src, alt });
    }
  }
  return found;
}

const GENERIC_NAME = /(photo-\d|img[-_ ]?\d|image[-_ ]?\d|img_\d|dsc[_-]?\d|screenshot|untitled|pasted|copy|final\d*\.|asset\d)/i;

describe("every <img> in the app", () => {
  const tags = imgTags();

  it("found some, so the scan is not silently empty", () => {
    expect(tags.length).toBeGreaterThan(2);
  });

  it("has alt text, and only decorative images may have an empty alt", () => {
    for (const tag of tags) {
      expect(tag.alt, `${tag.file}: an <img> with no alt attribute is invisible to a screen reader and to image search`).not.toBeNull();
      if (tag.alt === "") {
        const decorative = /aria-hidden|role="presentation"/.test(tag.attrs);
        expect(
          decorative,
          `${tag.file}: empty alt is only correct for decoration — mark it aria-hidden or give it a description`,
        ).toBe(true);
      } else if (tag.alt) {
        expect(tag.alt.length, `${tag.file}: alt="${tag.alt}" is too thin to describe anything`).toBeGreaterThan(15);
      }
    }
  });

  it("serves images from our own origin, never a third-party CDN", () => {
    for (const tag of tags) {
      if (!tag.src) continue; // src={dataUrl} and friends: generated at runtime, ours by definition
      const external = /^https?:\/\//.test(tag.src) && !tag.src.startsWith("https://www.focusarx.site");
      expect(
        external,
        `${tag.file}: ${tag.src} is hotlinked — a third-party CDN owns the image search credit, the cache and the uptime`,
      ).toBe(false);
    }
  });

  it("carries width and height so the layout cannot shift", () => {
    for (const tag of tags) {
      if (tag.attrs.includes("width={") || /\bwidth="\d/.test(tag.attrs)) {
        expect(/\bheight=/, `${tag.file}: width without height still shifts layout`).toBeTruthy();
      } else {
        expect(false, `${tag.file}: <img> without intrinsic width/height causes CLS while it loads`).toBe(true);
      }
    }
  });

  it("uses descriptive filenames in modern formats for public images", () => {
    for (const tag of tags) {
      if (!tag.src || !tag.src.startsWith("/")) continue;
      const name = tag.src.split("/").pop()!;
      const ext = name.split(".").pop()!;
      expect(["webp", "avif", "svg", "png", "jpg", "jpeg"], `${tag.file}: unknown format ${name}`).toContain(ext);
      // Raster content images ship as WebP; PNG/JPG are reserved for brand
      // marks and social cards, SVG for line art.
      if (tag.src.startsWith("/content/")) {
        expect(["webp", "avif"], `${tag.file}: content image ${name} should ship as WebP or AVIF`).toContain(ext);
      }
      expect(GENERIC_NAME.test(name), `${tag.file}: ${name} is a filename nobody can search for`).toBe(false);
      expect(name, `${tag.file}: ${name} is not descriptive`).toMatch(/^[a-z0-9]+(-[a-z0-9]+){2,}\./);
      // And it must actually exist in public/.
      expect(existsSync(path.join(PUBLIC, tag.src)), `${tag.file}: ${tag.src} does not exist`).toBe(true);
    }
  });
});
