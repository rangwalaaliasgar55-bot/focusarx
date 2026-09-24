import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROFILE_ICON_IDS } from "./profileIcons";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const mixer = readFileSync(resolve(repoRoot, "artifacts/focusarx/src/components/AmbientSoundBar.tsx"), "utf8");
const admin = readFileSync(resolve(repoRoot, "artifacts/focusarx/src/components/admin/AdminSitePanel.tsx"), "utf8");
const api = readFileSync(resolve(repoRoot, "artifacts/api-server/src/routes/site.ts"), "utf8");

describe("ambient catalog contracts", () => {
  it("keeps playback audio-first and gives the listener a persistent loop control", () => {
    expect(mixer).not.toContain("<iframe");
    expect(mixer).not.toContain("youtube-nocookie");
    expect(mixer).toContain("el.loop = isTrackLooping(track)");
    expect(mixer).toContain("setTrackLoop(track, !looping)");
    expect(mixer).toContain("TRACK_PREFERENCES_KEY");
  });

  it("requires a licensed direct-audio draft and explicit release before public playback", () => {
    expect(admin).toContain("Save as draft");
    expect(admin).toContain("Direct audio URL");
    expect(admin).toContain("License");
    expect(api).toContain("YouTube links are not supported");
    expect(api).toContain('eq(ambientTracksTable.status, "published")');
    expect(api).toContain('router.post(`/admin/ambient-tracks/:id/${action}`');
    expect(api).toContain("ambientTrackAnalytics");
  });

  it("ships attributed, direct-playable starter recordings and a bounded profile icon set", () => {
    const audioRoot = resolve(repoRoot, "artifacts/focusarx/public/ambient/chillnsound");
    expect(readFileSync(resolve(audioRoot, "ATTRIBUTION.md"), "utf8")).toContain("MIT License");
    for (const name of ["rain", "forest", "river", "beach", "fire", "birds", "leaves", "windchimes"]) {
      const file = resolve(audioRoot, `${name}.mp3`);
      expect(existsSync(file), `${name}.mp3 should be bundled`).toBe(true);
      expect(statSync(file).size, `${name}.mp3 should not be an empty placeholder`).toBeGreaterThan(100_000);
    }
    expect(new Set(PROFILE_ICON_IDS).size).toBe(PROFILE_ICON_IDS.length);
    expect(PROFILE_ICON_IDS.length).toBeGreaterThanOrEqual(10);
  });
});
