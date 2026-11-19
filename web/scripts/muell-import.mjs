// Müll-Termine aus der iCal-Datei von Müllmax übernehmen (Stadtbildpflege Kaiserslautern).
// Aufruf: npm run muell -- /pfad/zur/SK_Abfuhrtermine.ics
// Schreibt nur Datum, Abfallart und Rhythmus nach src/muell-termine.json – keine Adresse,
// weil das Repo und die Seite öffentlich sind.
// Neue Datei holen: ask.muellmax.de → Abfuhrtermine für Ihre Wohnadresse → iCal,
// Option „Einzeltermine“ (nicht Terminserien), alle Abfallarten.
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const file = process.argv[2]
if (!file) {
  console.error("Bitte Pfad zur .ics-Datei angeben: npm run muell -- datei.ics")
  process.exit(1)
}

// Fortsetzungszeilen (beginnen mit Leerzeichen/Tab) an die vorige Zeile hängen
const lines = readFileSync(file, "utf8").replace(/\r?\n[ \t]/g, "").split(/\r?\n/)

const TYPES = [
  [/restabfall/i, "rest"],
  [/bioabfall/i, "bio"],
  [/gelbe tonne|gelber sack/i, "gelb"],
  [/altpapier|papier/i, "papier"],
]

const out = []
let ev = null
for (const line of lines) {
  if (line === "BEGIN:VEVENT") ev = {}
  else if (line === "END:VEVENT" && ev) {
    if (ev.date && ev.summary) {
      const type = TYPES.find(([re]) => re.test(ev.summary))?.[1] ?? "sonst"
      const rhythm = (ev.summary.match(/Abfuhr\s+(.+)$/i)?.[1] ?? "").trim()
      out.push({ date: ev.date, type, rhythm })
    }
    ev = null
  } else if (ev) {
    const m = line.match(/^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/)
    if (m) ev.date = `${m[1]}-${m[2]}-${m[3]}`
    if (line.startsWith("SUMMARY:")) ev.summary = line.slice(8).replace(/\\,/g, ",")
  }
}

out.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type))
const target = fileURLToPath(new URL("../src/muell-termine.json", import.meta.url))
writeFileSync(target, JSON.stringify(out, null, 0).replace(/\},\{/g, "},\n{") + "\n")

const summary = {}
for (const t of out) summary[`${t.type} · ${t.rhythm || "–"}`] = (summary[`${t.type} · ${t.rhythm || "–"}`] ?? 0) + 1
console.log(`${out.length} Termine von ${out[0]?.date} bis ${out.at(-1)?.date} → src/muell-termine.json`)
console.table(summary)
