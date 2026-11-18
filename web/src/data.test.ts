import { describe, expect, it } from "vitest"
import { accentFor, dayLabel, eyebrow, isCacheUsable, minutesLabel, shortLabel, splitTitle } from "./data"

const now = new Date("2026-11-18T10:00:00Z") // Mittwoch

describe("Labels", () => {
  it("Heute / Morgen / Wochentag", () => {
    expect(dayLabel("2026-11-18", "Mittwoch", now)).toBe("Heute")
    expect(dayLabel("2026-11-19", "Donnerstag", now)).toBe("Morgen")
    expect(dayLabel("2026-11-20", "Freitag", now)).toBe("Freitag")
    expect(shortLabel("2026-11-20", "Freitag", now)).toBe("Fr")
    expect(shortLabel("2026-11-19", "Donnerstag", now)).toBe("Morgen")
  })
  it("Eyebrow", () => {
    expect(eyebrow("2026-11-18", "Mittwoch", now)).toBe("Heute · Mittwoch, 18. November")
    expect(eyebrow("2026-11-20", "Freitag", now)).toBe("Freitag, 20. November")
  })
  it("Berliner Mitternacht zählt, nicht UTC", () => {
    expect(dayLabel("2026-11-19", "Donnerstag", new Date("2026-11-18T23:30:00Z"))).toBe("Heute")
  })
})

describe("splitTitle", () => {
  it("teilt an mit/in", () => {
    expect(splitTitle("Möhrenreis mit Lachsfilet")).toEqual(["Möhrenreis", "mit Lachsfilet"])
    expect(splitTitle("Hähnchen in Zitronen-Senf-Sauce")).toEqual(["Hähnchen", "in Zitronen-Senf-Sauce"])
    expect(splitTitle("Käsespätzle")).toEqual(["Käsespätzle", ""])
  })
  it("teilt am ersten Bindewort", () => {
    expect(splitTitle("Schnelles Thai-Curry mit Huhn, Paprika und feiner Erdnussnote")[0]).toBe("Schnelles Thai-Curry")
  })
})

describe("Sonstiges", () => {
  it("Cache nur wenn nicht veraltet", () => {
    expect(isCacheUsable({ generatedAt: "", days: [{ date: "2026-11-18", weekday: "Mittwoch", dish: null }] }, now)).toBe(true)
    expect(isCacheUsable({ generatedAt: "", days: [{ date: "2026-11-17", weekday: "Dienstag", dish: null }] }, now)).toBe(false)
    expect(isCacheUsable(null, now)).toBe(false)
  })
  it("Zeiten und Farben", () => {
    expect(minutesLabel(35)).toBe("35 Min.")
    expect(minutesLabel(90)).toBe("1 Std. 30 Min.")
    expect(minutesLabel(null)).toBeNull()
    expect(accentFor("fleisch")).toBe("#f6a37c")
    expect(accentFor(null)).toBe("#e3d9cc")
  })
})
