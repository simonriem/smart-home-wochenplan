import { describe, expect, it } from "vitest"
import { darkCss, parseTheme, themed } from "./theme"

describe("theme", () => {
  it("erkennt nur gültige Werte", () => {
    expect(parseTheme("dark")).toBe("dark")
    expect(parseTheme("light")).toBe("light")
    expect(parseTheme("auto")).toBe("auto")
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
})
