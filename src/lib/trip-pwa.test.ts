import { describe, expect, it } from "vitest";
import {
  TRIP_APPLE_SPLASH_SCREENS,
  TRIP_APPLE_TOUCH_ICON_HREF,
  TRIP_MANIFEST_HREF,
  appleSplashMediaQuery,
  buildTripPwaLinks,
} from "./trip-pwa";

describe("TRIP_APPLE_SPLASH_SCREENS", () => {
  it("has no duplicate physical resolutions (file names unique)", () => {
    const fileNames = TRIP_APPLE_SPLASH_SCREENS.map((s) => s.fileName);
    expect(new Set(fileNames).size).toBe(fileNames.length);
  });

  it("every entry's file name encodes its physical pixel size (css * dpr)", () => {
    for (const screen of TRIP_APPLE_SPLASH_SCREENS) {
      const physicalW = screen.cssWidth * screen.devicePixelRatio;
      const physicalH = screen.cssHeight * screen.devicePixelRatio;
      expect(screen.fileName).toBe(`apple-splash-${physicalW}x${physicalH}.png`);
    }
  });
});

describe("appleSplashMediaQuery", () => {
  it("builds a media query matching device-width/height and pixel ratio in portrait", () => {
    expect(
      appleSplashMediaQuery({
        fileName: "x",
        cssWidth: 390,
        cssHeight: 844,
        devicePixelRatio: 3,
      }),
    ).toBe(
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    );
  });
});

describe("buildTripPwaLinks", () => {
  const links = buildTripPwaLinks();

  it("includes the manifest link first", () => {
    expect(links[0]).toEqual({ rel: "manifest", href: TRIP_MANIFEST_HREF });
  });

  it("includes the apple-touch-icon link", () => {
    expect(links).toContainEqual({ rel: "apple-touch-icon", href: TRIP_APPLE_TOUCH_ICON_HREF });
  });

  it("includes one apple-touch-startup-image per configured splash screen, each with a media query", () => {
    const splashLinks = links.filter((l) => l.rel === "apple-touch-startup-image");
    expect(splashLinks).toHaveLength(TRIP_APPLE_SPLASH_SCREENS.length);
    for (const link of splashLinks) {
      expect(link.media).toBeTruthy();
      expect(link.href.startsWith("/trip/splash/")).toBe(true);
    }
  });

  it("total link count is manifest + apple-touch-icon + all splash screens", () => {
    expect(links).toHaveLength(2 + TRIP_APPLE_SPLASH_SCREENS.length);
  });
});
