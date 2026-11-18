// Daten für das Tablet: Abruf bei der Edge Function, lokaler Zwischenspeicher, Anzeige-Helfer.

export type Dish = {
  name: string
  slug: string | null
  image: string | null
  totalMinutes: number | null
  kcal: number | null
  protein: number | null
  diet: string | null
  cook: string | null
}

export type Day = { date: string; weekday: string; dish: Dish | null }
export type Plan = { generatedAt: string; days: Day[] }

export const API_URL = "https://ombgktunotqrrbzzklmf.supabase.co/functions/v1/wochenplan"
const CACHE_KEY = "wochenplan-cache-v1"

export async function fetchPlan(key: string, signal?: AbortSignal): Promise<Plan> {
  const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, { signal, cache: "no-store" })
  if (res.status === 401) throw new Error("Dashboard-Schlüssel stimmt nicht")
  if (!res.ok) throw new Error(`Abruf fehlgeschlagen (${res.status})`)
  const plan = (await res.json()) as Plan
  if (!Array.isArray(plan.days)) throw new Error("Unerwartete Antwort")
  return plan
}

export function readCache(): Plan | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Plan) : null
  } catch {
    return null
  }
}

export function writeCache(plan: Plan): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(plan))
  } catch {
    /* Speicher voll oder gesperrt – egal, nur Komfort */
  }
}

/** Heutiges Datum in Berlin als YYYY-MM-DD. */
export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now)
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Ein zwischengespeicherter Plan ist nur brauchbar, wenn sein erster Tag nicht in der Vergangenheit liegt. */
export function isCacheUsable(plan: Plan | null, now = new Date()): boolean {
  return !!plan?.days?.length && plan.days[0].date >= berlinToday(now)
}

/** "Heute" / "Morgen" / Wochentag. */
export function dayLabel(date: string, weekday: string, now = new Date()): string {
  const today = berlinToday(now)
  if (date === today) return "Heute"
  if (date === shiftDate(today, 1)) return "Morgen"
  return weekday
}

/** Kurzform für die Leiste: "Do", "Fr", … oder "Morgen". */
export function shortLabel(date: string, weekday: string, now = new Date()): string {
  const label = dayLabel(date, weekday, now)
  return label === weekday ? weekday.slice(0, 2) : label
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]

/** "Heute · Mittwoch, 18. November" */
export function eyebrow(date: string, weekday: string, now = new Date()): string {
  const [, m, d] = date.split("-").map(Number)
  const label = dayLabel(date, weekday, now)
  const datePart = `${d}. ${MONTHS[m - 1]}`
  return label === weekday ? `${weekday}, ${datePart}` : `${label} · ${weekday}, ${datePart}`
}

/**
 * Rezeptnamen für die zweizeilige Überschrift teilen: kräftig das Gericht,
 * dünn der Zusatz ab "mit"/"in"/"aus"/"auf"/"nach". "Hähnchen in Zitronen-Senf-Sauce"
 * → ["Hähnchen", "in Zitronen-Senf-Sauce"].
 */
export function splitTitle(name: string): [string, string] {
  const clean = name.replace(/\s+/g, " ").trim()
  const m = clean.match(/^(.+?)\s+((?:mit|in|aus|auf|nach|an|vom|von)\s.+)$/i)
  if (m && m[1].length >= 3) return [m[1].replace(/[,–-]\s*$/, ""), m[2]]
  return [clean, ""]
}

/** Schriftgröße, damit eine Zeile mit `chars` Zeichen in `width` px passt. */
export function fitSize(chars: number, max: number, min: number, width: number, em: number): number {
  return Math.max(min, Math.min(max, width / (Math.max(1, chars) * em)))
}

/** Farbe des Bogens nach Ernährungsform. */
export function accentFor(diet: string | null | undefined): string {
  switch (diet) {
    case "fleisch": return "#f6a37c"
    case "vegetarisch": return "#bcd98e"
    case "vegan": return "#9fdcc2"
    case "fisch": return "#9fcbe8"
    default: return "#e3d9cc"
  }
}

export function minutesLabel(min: number | null): string | null {
  if (!min) return null
  if (min < 60) return `${min} Min.`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `${h} Std. ${r} Min.` : `${h} Std.`
}

/** Beispieldaten für ?demo=1 (Bilder von der Kochbuch-Seite). */
export function demoPlan(now = new Date()): Plan {
  const today = berlinToday(now)
  const wd = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
  const day = (i: number) => {
    const date = shiftDate(today, i)
    return { date, weekday: wd[new Date(date + "T12:00:00Z").getUTCDay()] }
  }
  const img = (f: string) => `https://bunkyo-kochbuch.vercel.app/recipes/images/${f}`
  return {
    generatedAt: now.toISOString(),
    days: [
      { ...day(0), dish: { name: "Hähnchen in Zitronen-Senf-Sauce", slug: "haehnchen-in-zitronen-senf-sauce", image: img("haehnchen-in-zitronen-senf-sauce.webp"), totalMinutes: 35, kcal: 540, protein: 41, diet: "fleisch", cook: "Riem" } },
      { ...day(1), dish: { name: "Käsespätzle", slug: "kaesespaetzle", image: img("kaesespaetzle.webp"), totalMinutes: 40, kcal: 720, protein: 30, diet: "vegetarisch", cook: "Kuhn" } },
      { ...day(2), dish: { name: "Möhrenreis mit Lachsfilet", slug: "moehrenreis-mit-lachsfilet", image: img("moehrenreis-mit-lachsfilet.webp"), totalMinutes: 30, kcal: 610, protein: 38, diet: "fisch", cook: "Riem" } },
      { ...day(3), dish: null },
    ],
  }
}
