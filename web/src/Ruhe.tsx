import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { dayLabel, minutesLabel, type Day } from "./data"
import { MUELL_INFO, naechsteAbholungen, wannLabel } from "./muell"
import { darkCss } from "./theme"
import { beschreibe, fetchWetter, readWetterCache, type Art, type Wetter } from "./wetter"

/*
 * Ruhe-Ansicht fürs Vorbeigehen (Bildschirmschoner in Fully Kiosk: ?view=ruhe).
 * Große Uhr, Datum, Wetter; rechts was es gibt und wann welche Tonne raus muss.
 * Der Inhalt wandert alle paar Minuten ganz langsam ein Stück, damit es lebendig wirkt.
 */

const W = 960
const H = 600
const WETTER_MS = 15 * 60_000
const COOK_COLOR: Record<string, string> = { Riem: "#e0895e", Kuhn: "#6f9fc6" }
const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]

const CSS = `
.ru{position:relative;width:100%;height:100%;overflow:hidden;background:#f4efe8;color:#2b2622;
  font-family:wo-face,ui-sans-serif,system-ui,sans-serif;user-select:none;-webkit-tap-highlight-color:transparent;
  --muted:#8a8178;--soft:#5e554c;--card:rgba(255,255,255,.6);--line:rgba(43,38,34,.08);--glow:#f6a37c}
.ru *{box-sizing:border-box}
.ru-stage{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform:translate(-50%,-50%) scale(var(--ru-s,1))}
.ru-drift{position:absolute;inset:0;transition:transform 90s ease-in-out}
.ru-glow{position:absolute;left:-180px;top:-220px;width:760px;height:760px;border-radius:50%;
  background:radial-gradient(closest-side,var(--glow),transparent);opacity:.22;pointer-events:none}
.ru-left{position:absolute;left:70px;top:88px;width:470px}
.ru-clock{font-size:176px;font-weight:200;letter-spacing:-.045em;line-height:.9;font-variant-numeric:tabular-nums;margin:0 0 0 -8px}
.ru-date{font-size:26px;font-weight:500;margin:18px 0 0 2px;color:var(--soft)}
.ru-weather{display:flex;align-items:center;gap:18px;margin-top:46px}
.ru-wico{width:64px;height:64px;flex:none;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;color:var(--soft)}
.ru-wico .sun{stroke:#e0895e}
.ru-temp{font-size:56px;font-weight:300;letter-spacing:-.03em;line-height:1}
.ru-wtxt{font-size:16px;line-height:1.45;color:var(--soft)}
.ru-wtxt b{font-weight:600;color:inherit}
.ru-right{position:absolute;right:56px;top:72px;width:330px;display:flex;flex-direction:column;gap:18px}
.ru-card{background:var(--card);border-radius:24px;padding:20px 22px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
  box-shadow:0 18px 40px -26px rgba(60,40,20,.35)}
.ru-h{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.ru-dish{display:flex;align-items:center;gap:16px}
.ru-thumb{flex:none;width:96px;height:96px;border-radius:50%;overflow:hidden;background:#e9e1d6;box-shadow:0 8px 16px -6px rgba(60,40,20,.35),0 0 0 5px rgba(255,255,255,.7)}
.ru-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ru-dname{font-size:21px;font-weight:600;line-height:1.2;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ru-dmeta{font-size:14px;color:var(--soft);margin-top:6px;display:flex;align-items:center;gap:7px}
.ru-dot{width:9px;height:9px;border-radius:50%;flex:none}
.ru-empty{font-size:17px;color:var(--soft)}
.ru-bins{list-style:none;margin:0;padding:0}
.ru-bins li{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:17px}
.ru-bins li:last-child{border-bottom:0}
.ru-bin{flex:none;width:16px;height:20px;border-radius:3px 3px 5px 5px;position:relative}
.ru-bin::before{content:"";position:absolute;left:-2px;right:-2px;top:-4px;height:3px;border-radius:2px;background:inherit}
.ru-bname{flex:1}
.ru-when{font-weight:600;font-variant-numeric:tabular-nums}
.ru-bins li.soon{font-size:19px;font-weight:600}
.ru-bins li.soon .ru-when{padding:3px 11px;border-radius:99px;background:#2b2622;color:#f4efe8}
.ru-hint{font-size:13px;color:var(--muted);margin-top:10px}
.ru-tap{position:absolute;left:0;right:0;bottom:26px;text-align:center;font-size:13px;color:var(--muted);letter-spacing:.02em}
` + darkCss(`
.ru{background:#1f1915;color:#f1e6d8;--muted:#a8998a;--soft:#cbbcab;--card:rgba(255,236,214,.06);--line:rgba(255,236,214,.08);--glow:#c8743f}
.ru-glow{opacity:.18}
.ru-card{box-shadow:0 18px 40px -26px rgba(0,0,0,.7)}
.ru-thumb{background:#2c241e;box-shadow:0 8px 16px -6px rgba(0,0,0,.6),0 0 0 5px rgba(255,236,214,.08)}
.ru-thumb img{filter:brightness(.9)}
.ru-bins li.soon .ru-when{background:#e9b07a;color:#241b15}
`)

function Icon({ art, day }: { art: Art; day: boolean }) {
  const sun = day
    ? <g className="sun"><circle cx="24" cy="24" r="8" /><path d="M24 8v4M24 36v4M8 24h4M36 24h4M12.7 12.7l2.8 2.8M32.5 32.5l2.8 2.8M12.7 35.3l2.8-2.8M32.5 15.5l2.8-2.8" /></g>
    : <path className="sun" d="M30 12a12 12 0 1 0 6 18 10 10 0 0 1-6-18z" />
  const cloud = (y = 0) => <path d={`M16 ${38 + y}h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13z`} />
  const small = <g transform="translate(-8 -8) scale(.72)">{sun}</g>
  const drops = (n: number) => Array.from({ length: n }, (_, i) => <path key={i} d={`M${17 + i * 7} 42l-2 5`} />)
  switch (art) {
    case "sonne": return <svg className="ru-wico" viewBox="0 0 48 48">{sun}</svg>
    case "teils": return <svg className="ru-wico" viewBox="0 0 48 48">{small}{cloud(2)}</svg>
    case "wolken": return <svg className="ru-wico" viewBox="0 0 48 48">{cloud()}</svg>
    case "nebel": return <svg className="ru-wico" viewBox="0 0 48 48"><path d="M8 18h32M12 25h28M8 32h32M14 39h22" /></svg>
    case "niesel": return <svg className="ru-wico" viewBox="0 0 48 48">{cloud(-4)}{drops(2)}</svg>
    case "regen": return <svg className="ru-wico" viewBox="0 0 48 48">{cloud(-4)}{drops(3)}</svg>
    case "schnee": return <svg className="ru-wico" viewBox="0 0 48 48">{cloud(-4)}<path d="M18 43h.01M25 45h.01M32 43h.01" strokeWidth="3" /></svg>
    case "gewitter": return <svg className="ru-wico" viewBox="0 0 48 48">{cloud(-4)}<path d="M25 36l-4 6h6l-4 6" /></svg>
  }
}

function useWetter(): Wetter | null {
  const [w, setW] = useState<Wetter | null>(() => readWetterCache())
  useEffect(() => {
    let alive = true
    const load = () => fetchWetter().then((x) => alive && setW(x)).catch(() => alive && setW((old) => old ?? readWetterCache()))
    load()
    const t = window.setInterval(load, WETTER_MS)
    return () => { alive = false; window.clearInterval(t) }
  }, [])
  return w
}

const r = (n: number) => Math.round(n)

export function Ruhe({ day, now }: { day: Day | null; now: Date }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wetter = useWetter()
  const [drift, setDrift] = useState("translate(0px,0px)")

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const fit = () => el.style.setProperty("--ru-s", String(Math.min(el.clientWidth / W, el.clientHeight / H)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // langsames Wandern (aus bei "Bewegung reduzieren")
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const move = () => setDrift(`translate(${r(Math.random() * 36 - 18)}px,${r(Math.random() * 24 - 12)}px)`)
    const t = window.setInterval(move, 3 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(now)
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(now).map((p) => [p.type, p.value]))
  const wdIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)
  const dateText = `${WD[wdIndex]}, ${Number(parts.day)}. ${MONTHS[Number(parts.month) - 1]}`

  const bins = naechsteAbholungen(now).slice(0, 4)
  const dish = day?.dish ?? null
  const label = day ? dayLabel(day.date, day.weekday, now) : "Heute"
  const wb = wetter ? beschreibe(wetter.code) : null

  return (
    <div className="ru" ref={rootRef} onClick={() => (location.href = "./")}>
      <style>{"@font-face{font-family:wo-face;src:url(./outfit.woff2) format('woff2');font-weight:100 900;font-display:swap}" + CSS}</style>
      <div className="ru-stage">
        <div className="ru-drift" style={{ transform: drift }}>
          <div className="ru-glow" />
          <div className="ru-left">
            <p className="ru-clock">{time}</p>
            <p className="ru-date">{dateText}</p>
            {wetter && wb ? (
              <div className="ru-weather">
                <Icon art={wb.art} day={wetter.isDay} />
                <div className="ru-temp">{r(wetter.temp)}°</div>
                <div className="ru-wtxt">
                  <b>{wb.text}</b><br />
                  {r(wetter.heute.min)}° bis {r(wetter.heute.max)}°{wetter.heute.regen != null && wetter.heute.regen >= 20 ? ` · Regen ${wetter.heute.regen} %` : ""}
                  {wetter.morgen ? <><br />Morgen {beschreibe(wetter.morgen.code).text.toLowerCase()}, bis {r(wetter.morgen.max)}°</> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="ru-right">
            <section className="ru-card">
              <p className="ru-h">{`${label} gibt’s`}</p>
              {dish ? (
                <div className="ru-dish">
                  <div className="ru-thumb">{dish.image ? <img src={dish.image} alt="" /> : null}</div>
                  <div>
                    <div className="ru-dname">{dish.name}</div>
                    <div className="ru-dmeta">
                      {dish.cook ? <><span className="ru-dot" style={{ background: COOK_COLOR[dish.cook] ?? "#aaa" }} />{dish.cook}</> : null}
                      {dish.cook && dish.totalMinutes ? " · " : null}
                      {minutesLabel(dish.totalMinutes)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ru-empty">{day?.note?.text ?? "Noch nichts geplant"}</div>
              )}
            </section>

            <section className="ru-card">
              <p className="ru-h">Müll</p>
              {bins.length ? (
                <ul className="ru-bins">
                  {bins.map((b) => (
                    <li key={b.type} className={b.inDays <= 1 ? "soon" : undefined}>
                      <span className="ru-bin" style={{ background: MUELL_INFO[b.type].color }} />
                      <span className="ru-bname">{MUELL_INFO[b.type].name}</span>
                      <span className="ru-when">{wannLabel(b)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ru-empty">Keine Termine mehr gespeichert</div>
              )}
              {bins.some((b) => b.inDays === 1) ? <p className="ru-hint">Heute Abend rausstellen</p> : null}
              {bins.length < 4 ? <p className="ru-hint">Neue Abfuhrtermine einlesen (Müllmax)</p> : null}
            </section>
          </div>

          <div className="ru-tap">Tippen für den Wochenplan</div>
        </div>
      </div>
    </div>
  )
}
