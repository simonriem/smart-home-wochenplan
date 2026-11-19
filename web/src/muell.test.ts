import { describe, expect, it } from "vitest"
import { naechsteAbholungen, wannLabel, type Termin } from "./muell"

const DATA: Termin[] = [
  { date: "2026-11-19", type: "rest", rhythm: "2x wöchentlich" },
  { date: "2026-11-25", type: "rest", rhythm: "alle 2 Wochen" },
  { date: "2026-12-09", type: "rest", rhythm: "alle 2 Wochen" },
  { date: "2026-11-20", type: "bio", rhythm: "" },
  { date: "2026-11-25", type: "bio", rhythm: "" },
  { date: "2026-12-02", type: "gelb", rhythm: "alle 2 Wochen" },
  { date: "2026-12-09", type: "papier", rhythm: "alle 4 Wochen" },
  { date: "2026-11-23", type: "papier", rhythm: "wöchentlich" },
]
const AUSWAHL = { rest: "alle 2 Wochen", bio: "", gelb: "alle 2 Wochen", papier: "alle 4 Wochen" }

describe("muell", () => {
  it("nimmt je Tonne nur den gewählten Rhythmus und den nächsten Termin", () => {
    const r = naechsteAbholungen(new Date("2026-11-19T10:00:00Z"), DATA, AUSWAHL) // 11 Uhr MEZ
    expect(r.map((a) => `${a.type}:${a.date}:${a.inDays}`)).toEqual([
      "bio:2026-11-20:1",
      "rest:2026-11-25:6",
      "gelb:2026-12-02:13",
      "papier:2026-12-09:20",
    ])
  })

  it("zählt heutige Abholung nur bis mittags", () => {
    const morning = naechsteAbholungen(new Date("2026-11-20T08:00:00Z"), DATA, AUSWAHL)
    expect(morning[0]).toMatchObject({ type: "bio", inDays: 0 })
    const evening = naechsteAbholungen(new Date("2026-11-20T15:00:00Z"), DATA, AUSWAHL)
    expect(evening.find((a) => a.type === "bio")).toMatchObject({ date: "2026-11-25" })
  })

  it("beschriftet Tage", () => {
    expect(wannLabel({ type: "bio", date: "2026-11-20", inDays: 0 })).toBe("Heute")
    expect(wannLabel({ type: "bio", date: "2026-11-21", inDays: 1 })).toBe("Morgen")
    expect(wannLabel({ type: "bio", date: "2026-11-25", inDays: 6 })).toBe("Mi, 25.11.")
  })
})
