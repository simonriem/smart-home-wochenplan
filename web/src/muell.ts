// Müll-Termine (Stadtbildpflege Kaiserslautern, über Müllmax). Daten: src/muell-termine.json,
// neu einlesen mit `npm run muell -- datei.ics` (einmal im Jahr, sobald die neuen Termine da sind).
import termine from "./muell-termine.json"
import { berlinToday } from "./data"

export type MuellArt = "rest" | "bio" | "gelb" | "papier"
export type Termin = { date: string; type: string; rhythm: string }
export type Abholung = { type: MuellArt; date: string; inDays: number }

/**
 * Welcher Rhythmus für unsere Tonnen gilt (hängt von der Tonnengröße ab).
 * Die Müllmax-Datei enthält für Restabfall und Altpapier alle Varianten.
 * "" = es gibt nur einen Rhythmus.
 * Unsere Tonnen: Restmüll 90 l, Papier (PPK) 240 l, Bio 120 l, dazu die Gelbe Tonne.
 */
export const AUSWAHL: Record<MuellArt, string> = {
  rest: "alle 2 Wochen",
  bio: "",
  gelb: "alle 2 Wochen",
  papier: "alle 4 Wochen",
}

export const MUELL_INFO: Record<MuellArt, { name: string; color: string }> = {
  rest: { name: "Restmüll", color: "#6b6560" },
  bio: { name: "Biotonne", color: "#8a5a3b" },
  gelb: { name: "Gelbe Tonne", color: "#e2b93b" },
  papier: { name: "Papier", color: "#3f6fb5" },
}

/** Bis zu dieser Stunde zählt eine Abholung von heute noch als anstehend. */
const HEUTE_BIS = 12

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000)
}

function berlinHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).formatToParts(now)
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0)
}

/** Nächste Abholung je Tonne, sortiert nach Datum. */
export function naechsteAbholungen(now = new Date(), data: Termin[] = termine as Termin[], auswahl = AUSWAHL): Abholung[] {
  const today = berlinToday(now)
  const vormittag = berlinHour(now) < HEUTE_BIS
  const result: Abholung[] = []
  for (const type of Object.keys(auswahl) as MuellArt[]) {
    const next = data
      .filter((t) => t.type === type && t.rhythm === auswahl[type])
      .filter((t) => t.date > today || (t.date === today && vormittag))
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (next) result.push({ type, date: next.date, inDays: daysBetween(today, next.date) })
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))
}

/** Letztes Datum in den Daten – danach braucht es eine neue Datei. */
export function datenBis(data: Termin[] = termine as Termin[]): string | null {
  return data.length ? data.reduce((m, t) => (t.date > m ? t.date : m), data[0].date) : null
}

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

/** "Heute", "Morgen", "Mi, 25.11." */
export function wannLabel(a: Abholung): string {
  if (a.inDays === 0) return "Heute"
  if (a.inDays === 1) return "Morgen"
  const d = new Date(a.date + "T12:00:00Z")
  return `${WD[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
}
