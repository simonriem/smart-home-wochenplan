// Findet Zeitangaben im Text eines Rezeptschritts ("15 Minuten", "2–3 Min.", "1 Std.")
// und macht daraus Timer-Vorschläge. Sehr kurze Angaben (Thermomix "5 Sek./Stufe 6")
// und sehr lange ("48 Stunden ruhen") werden ignoriert.

export type Duration = { text: string; seconds: number }

const MIN_SECONDS = 30
const MAX_SECONDS = 12 * 3600
const UNIT: Record<string, number> = { sek: 1, sekunde: 1, sekunden: 1, min: 60, minute: 60, minuten: 60, std: 3600, stunde: 3600, stunden: 3600 }
const PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|—|bis)\s*(\d+(?:[.,]\d+)?)\s*)?(Sekunden|Sekunde|Sek\.|Sek|Minuten|Minute|Min\.|Min|Stunden|Stunde|Std\.|Std)(?![a-zäöüßA-ZÄÖÜ])/g

export function findDurations(text: string): Duration[] {
  const out: Duration[] = []
  const seen = new Set<number>()
  for (const m of text.matchAll(PATTERN)) {
    const unit = UNIT[m[3].toLowerCase().replace(".", "")]
    // Bei Spannen ("2–3 Minuten") die längere Zeit nehmen – man kann früher abbrechen.
    const value = parseFloat((m[2] ?? m[1]).replace(",", "."))
    const seconds = Math.round(value * unit)
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS || seen.has(seconds)) continue
    seen.add(seconds)
    out.push({ text: m[0], seconds })
  }
  return out
}

/** 754 → "12:34", 3700 → "1:01:40" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}
