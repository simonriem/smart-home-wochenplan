/*
 * Hell/Dunkel. Standard ist "sonne": Die Seite rechnet selbst Sonnenauf- und -untergang
 * für Kaiserslautern aus und ist dazwischen hell, sonst dunkel. Das klappt auch in
 * Fully Kiosk, dessen WebView den Dunkelmodus des Tablets nicht zuverlässig weitergibt.
 * Weitere Wahl per Adresse (das Tablet merkt sie sich):
 *   ?theme=sonne  nach Sonnenstand (Standard)
 *   ?theme=auto   nach Dunkelmodus des Geräts (prefers-color-scheme)
 *   ?theme=light / ?theme=dark  fest
 */

export type ThemeChoice = "sonne" | "auto" | "light" | "dark"
const THEME_STORE = "wochenplan-theme"
const LAT = 49.444 // Kaiserslautern
const LON = 7.769

export function parseTheme(value: string | null | undefined): ThemeChoice | null {
  return value === "sonne" || value === "auto" || value === "light" || value === "dark" ? value : null
}

const RAD = Math.PI / 180
const toJulian = (ms: number) => ms / 86_400_000 + 2440587.5
const fromJulian = (j: number) => (j - 2440587.5) * 86_400_000

/** Sonnenauf- und -untergang (Sonnenaufgangsgleichung, auf ca. 1–2 Min. genau) für den Kalendertag von `at` (UTC). */
export function sunTimes(at: Date, lat = LAT, lon = LON): { rise: Date; set: Date } | null {
  const n = Math.round(toJulian(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 12)) - 2451545 + 0.0008)
  const jStar = n - lon / 360
  const m = (357.5291 + 0.98560028 * jStar) % 360
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD)
  const lambda = (m + c + 180 + 102.9372) % 360
  const transit = 2451545 + jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD)
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD)
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec)
  if (cosW < -1 || cosW > 1) return null // Polartag/-nacht, hier nicht relevant
  const w = Math.acos(cosW) / RAD
  return { rise: new Date(fromJulian(transit - w / 360)), set: new Date(fromJulian(transit + w / 360)) }
}

/** Dunkel vor Sonnenaufgang und ab Sonnenuntergang. */
export function isDarkBySun(at: Date): boolean {
  const t = sunTimes(at)
  if (!t) return false
  return at < t.rise || at >= t.set
}

/**
 * Setzt jedem Selektor eines CSS-Blocks einen Präfix voran, z. B.
 * themed(".a,.b{x:1}", ":root[data-theme=dark]") → ":root[data-theme=dark] .a,:root[data-theme=dark] .b{x:1}".
 * Nur für einfache Regeln (keine verschachtelten @-Blöcke).
 */
export function themed(rules: string, prefix: string): string {
  return rules.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel: string, body: string) => {
    const s = sel
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => `${prefix} ${x}`)
      .join(",")
    return `${s}{${body}}`
  })
}

/** Dunkle Regeln für "auto" (Systemeinstellung) und für die feste Wahl ?theme=dark. */
export function darkCss(rules: string): string {
  return (
    `@media (prefers-color-scheme:dark){${themed(rules, ":root:not([data-theme=light])")}}` +
    themed(rules, ":root[data-theme=dark]")
  )
}

function readChoice(): ThemeChoice {
  const fromUrl = parseTheme(new URLSearchParams(location.search).get("theme"))
  try {
    if (fromUrl) localStorage.setItem(THEME_STORE, fromUrl)
    return fromUrl ?? parseTheme(localStorage.getItem(THEME_STORE)) ?? "sonne"
  } catch {
    return fromUrl ?? "sonne"
  }
}

/** Wird beim Start einmal aufgerufen (vor App, weil App die Adresse aufräumt). */
export function applyTheme(): void {
  const choice = readChoice()
  const root = document.documentElement
  const set = () => {
    const theme = choice === "sonne" ? (isDarkBySun(new Date()) ? "dark" : "light") : choice
    if (theme === "auto") delete root.dataset.theme
    else if (root.dataset.theme !== theme) root.dataset.theme = theme
    const meta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    if (theme !== "auto") meta.forEach((m) => (m.content = theme === "dark" ? "#1f1915" : "#f4efe8"))
  }
  set()
  if (choice === "sonne") {
    window.setInterval(set, 60_000)
    document.addEventListener("visibilitychange", set)
  }
}

if (typeof document !== "undefined") applyTheme()
