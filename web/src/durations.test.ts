import { describe, expect, it } from "vitest"
import { clock, findDurations } from "./durations"

describe("findDurations", () => {
  it("erkennt Minuten, Stunden und Spannen", () => {
    expect(findDurations("Im Ofen 25 Minuten backen.")).toEqual([{ text: "25 Minuten", seconds: 1500 }])
    expect(findDurations("2–3 Min. anbraten")).toEqual([{ text: "2–3 Min.", seconds: 180 }])
    expect(findDurations("1,5 Std. schmoren")).toEqual([{ text: "1,5 Std.", seconds: 5400 }])
  })
  it("ignoriert Thermomix-Sekunden und sehr lange Ruhezeiten", () => {
    expect(findDurations("5 Sek./Stufe 6 zerkleinern")).toEqual([])
    expect(findDurations("Teig 48 Stunden ruhen lassen")).toEqual([])
  })
  it("Thermomix-Garzeit mit Temperatur", () => {
    expect(findDurations("42-45 Min./90°C//Stufe 1 garen")[0].seconds).toBe(2700)
  })
  it("mehrere Zeiten, ohne Doppelte, kein 'Mini'", () => {
    expect(findDurations("10 Minuten kochen, dann 5 Minuten ziehen, nochmal 10 Minuten").map((d) => d.seconds)).toEqual([600, 300])
    expect(findDurations("3 Mini-Paprika")).toEqual([])
  })
})

describe("clock", () => {
  it("formatiert", () => {
    expect(clock(754)).toBe("12:34")
    expect(clock(3700)).toBe("1:01:40")
    expect(clock(-3)).toBe("0:00")
  })
})
