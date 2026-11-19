import { describe, expect, it } from "vitest"
import { beschreibe, parseWetter } from "./wetter"

describe("wetter", () => {
  it("liest die Open-Meteo-Antwort", () => {
    const w = parseWetter({
      current: { temperature_2m: 4.3, weather_code: 3, is_day: 1 },
      daily: { weather_code: [61, 2], temperature_2m_max: [6.1, 7], temperature_2m_min: [1.2, 0.5], precipitation_probability_max: [80, null] },
    }, 1)
    expect(w).toEqual({ at: 1, temp: 4.3, code: 3, isDay: true, heute: { code: 61, max: 6.1, min: 1.2, regen: 80 }, morgen: { code: 2, max: 7, min: 0.5, regen: null } })
  })

  it("übersetzt Wettercodes", () => {
    expect(beschreibe(0).art).toBe("sonne")
    expect(beschreibe(45).text).toBe("Nebel")
    expect(beschreibe(81).text).toBe("Regenschauer")
    expect(beschreibe(73).art).toBe("schnee")
    expect(beschreibe(95).art).toBe("gewitter")
  })
})
