/*
 * Hell/Dunkel: Standard ist "auto", dann folgt die Seite dem Dunkelmodus des Tablets
 * (Samsung: Sonnenuntergang bis Sonnenaufgang). Mit ?theme=dark, ?theme=light oder
 * ?theme=auto lässt sich das fest einstellen; die Wahl merkt sich das Tablet.
 */

export type ThemeChoice = "auto" | "light" | "dark"
const THEME_STORE = "wochenplan-theme"

export function parseTheme(value: string | null | undefined): ThemeChoice | null {
  return value === "auto" || value === "light" || value === "dark" ? value : null
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
    return fromUrl ?? parseTheme(localStorage.getItem(THEME_STORE)) ?? "auto"
  } catch {
    return fromUrl ?? "auto"
  }
}

/** Wird beim Start einmal aufgerufen (vor App, weil App die Adresse aufräumt). */
export function applyTheme(): void {
  const choice = readChoice()
  const root = document.documentElement
  if (choice === "auto") delete root.dataset.theme
  else root.dataset.theme = choice
}

if (typeof document !== "undefined") applyTheme()
