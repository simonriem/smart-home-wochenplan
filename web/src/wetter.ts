// Wetter für Kaiserslautern über Open-Meteo (kostenlos, ohne Schlüssel).
const URL_WETTER =
  "https://api.open-meteo.com/v1/forecast?latitude=49.444&longitude=7.769" +
  "&current=temperature_2m,weather_code,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
  "&timezone=Europe%2FBerlin&forecast_days=2"
const CACHE = "wochenplan-wetter-v1"
const MAX_ALTER = 3 * 60 * 60_000 // ältere Daten nicht mehr zeigen

export type Tag = { code: number; max: number; min: number; regen: number | null }
export type Wetter = { at: number; temp: number; code: number; isDay: boolean; heute: Tag; morgen: Tag | null }

type Raw = {
  current: { temperature_2m: number; weather_code: number; is_day: number }
  daily: { weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] }
}

export function parseWetter(raw: Raw, at = Date.now()): Wetter {
  const d = raw.daily
  const tag = (i: number): Tag | null =>
    d.weather_code[i] == null ? null : { code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], regen: d.precipitation_probability_max[i] ?? null }
  return { at, temp: raw.current.temperature_2m, code: raw.current.weather_code, isDay: raw.current.is_day === 1, heute: tag(0)!, morgen: tag(1) }
}

export async function fetchWetter(): Promise<Wetter> {
  const res = await fetch(URL_WETTER, { cache: "no-store" })
  if (!res.ok) throw new Error(`Wetter ${res.status}`)
  const w = parseWetter((await res.json()) as Raw)
  try { localStorage.setItem(CACHE, JSON.stringify(w)) } catch { /* nur Komfort */ }
  return w
}

export function readWetterCache(now = Date.now()): Wetter | null {
  try {
    const w = JSON.parse(localStorage.getItem(CACHE) ?? "null") as Wetter | null
    return w && now - w.at < MAX_ALTER ? w : null
  } catch {
    return null
  }
}

export type Art = "sonne" | "teils" | "wolken" | "nebel" | "niesel" | "regen" | "schnee" | "gewitter"

/** WMO-Wettercode → Art und deutscher Text. */
export function beschreibe(code: number): { art: Art; text: string } {
  if (code === 0) return { art: "sonne", text: "Klar" }
  if (code === 1) return { art: "teils", text: "Überwiegend klar" }
  if (code === 2) return { art: "teils", text: "Leicht bewölkt" }
  if (code === 3) return { art: "wolken", text: "Bedeckt" }
  if (code === 45 || code === 48) return { art: "nebel", text: "Nebel" }
  if (code >= 51 && code <= 57) return { art: "niesel", text: "Nieselregen" }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { art: "regen", text: code >= 80 ? "Regenschauer" : "Regen" }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { art: "schnee", text: "Schnee" }
  if (code >= 95) return { art: "gewitter", text: "Gewitter" }
  return { art: "wolken", text: "Bewölkt" }
}
