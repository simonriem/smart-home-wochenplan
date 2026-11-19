import { describe, expect, it } from "vitest"
import { darkCss, isDarkBySun, parseTheme, sunTimes, themed } from "./theme"

describe("theme", () => {
  it("erkennt nur gültige Werte", () => {
    expect(parseTheme("dark")).toBe("dark")
    expect(parseTheme("light")).toBe("light")
    expect(parseTheme("auto")).toBe("auto")
    expect(parseTheme("sonne")).toBe("sonne")
    expect(parseTheme("Dark")).toBeNull()
    expect(parseTheme(null)).toBeNull()
  })

  it("setzt jedem Selektor den Präfix voran", () => {
    expect(themed(".a,.b .c{x:1}\n.d{y:2}", "P")).toBe("P .a,P .b .c{x:1}P .d{y:2}")
  })

  it("baut Systemregel und feste Wahl", () => {
    const css = darkCss(".a{x:1}")
    expect(css).toContain("@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .a{x:1}}")
    expect(css).toContain(":root[data-theme=dark] .a{x:1}")
  })

  it("berechnet Sonnenzeiten für Kaiserslautern", () => {
    const nov = sunTimes(new Date("2026-11-19T12:00:00Z"))!
    // ca. 07:55 und 16:40 Uhr MEZ = 06:55 und 15:40 UTC
    expect(nov.rise.toISOString()).toMatch(/^2026-11-19T0(6:[45]|7:0)/)
    expect(nov.set.toISOString()).toMatch(/^2026-11-19T15:[34]/)
    const jun = sunTimes(new Date("2026-06-21T12:00:00Z"))!
    // ca. 05:25 und 21:40 Uhr MESZ = 03:25 und 19:40 UTC
    expect(jun.rise.toISOString()).toMatch(/^2026-06-21T03:[1-3]/)
    expect(jun.set.toISOString()).toMatch(/^2026-06-21T19:[34]/)
  })

  it("ist mittags hell und abends dunkel", () => {
    expect(isDarkBySun(new Date("2026-11-19T12:40:00Z"))).toBe(false) // 13:40 MEZ
    expect(isDarkBySun(new Date("2026-11-19T17:00:00Z"))).toBe(true) // 18:00 MEZ
    expect(isDarkBySun(new Date("2026-11-19T05:30:00Z"))).toBe(true) // 06:30 MEZ
  })
})
