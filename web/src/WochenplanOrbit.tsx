import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { accentFor, eyebrow, fitSize, minutesLabel, PLAN_URL, shortLabel, splitTitle, type Day, type Dish } from "./data"
import { RecipeSheet } from "./RecipeSheet"

/*
 * Wochenplan-Orbit fürs Wand-Tablet (Querformat), angepasst aus dem
 * "Dish Orbit Carousel": Das Gericht sitzt als runder Teller links; beim Wechsel
 * schwingt es auf einer weiten Bahn oben hinaus, das nächste von der anderen
 * Seite herein. Die zweizeilige Überschrift wischt aus und ein, die Infokarte
 * blendet über, der Pastellbogen dreht mit und nimmt die Farbe der Ernährungsform an.
 * Bedienung: Tippen auf einen der nächsten Tage, Wischen auf dem Teller, Pfeiltasten.
 * Nach RETURN_MS ohne Berührung geht es zurück auf den ersten (Haupt-)Tag.
 */

// Bühne: 960 × 600 (16:10), wird auf den Bildschirm skaliert.
const W = 960
const H = 600
// Teller: Box und daraus abgeleitet der Drehpunkt der Umlaufbahn (wie in der Vorlage: 69 % / -217 %).
const PL = 110
const PT = 96
const PS = 290
const ORBIT_X = PL + 0.69 * PS
const ORBIT_Y = PT - 2.17 * PS
const ORBIT_R = Math.hypot(PL + PS / 2 - ORBIT_X, PT + PS / 2 - ORBIT_Y)
const BAND_W = 118 * (PS / 245)
const SWING = 50
const RETURN_MS = 30_000

const ARC_REST = [[50, 98], [46, 124], [60, 126], [40, 100]]
const ARC_SWEEP = [38, 146]

function arcPath(a0: number, a1: number, steps = 48): string {
  const outer: string[] = []
  const inner: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180
    const h = (BAND_W / 2) * Math.pow(Math.sin(Math.PI * t), 0.45)
    const c = Math.cos(a)
    const s = Math.sin(a)
    outer.push((ORBIT_X + c * (ORBIT_R + h)).toFixed(1) + " " + (ORBIT_Y + s * (ORBIT_R + h)).toFixed(1))
    inner.push((ORBIT_X + c * (ORBIT_R - h)).toFixed(1) + " " + (ORBIT_Y + s * (ORBIT_R - h)).toFixed(1))
  }
  return "M" + outer.join("L") + "L" + inner.reverse().join("L") + "Z"
}

const HIDE_1 = "inset(0% 100% 0% 0%)" // kräftige Zeile: wischt von links
const HIDE_2 = "inset(0% 0% 0% 100%)" // dünne Zeile: wischt von rechts
const SHOW = "inset(0% 0% 0% 0%)"

const CSS = `
.wo-root{position:relative;width:100%;height:100%;overflow:hidden;touch-action:pan-y;background:#f4efe8;color:#2b2622;
  font-family:wo-face,ui-sans-serif,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;
  --muted:#8a8178;--card:rgba(255,255,255,.62)}
.wo-root *{box-sizing:border-box}
.wo-canvas{position:absolute;left:50%;top:50%;width:var(--wo-w,${W}px);height:${H}px;transform:translate(-50%,-50%) scale(var(--wo-s,1))}
.wo-arc{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:visible;pointer-events:none}
.wo-btn{appearance:none;border:0;background:none;color:inherit;font:inherit;padding:0;margin:0;cursor:pointer}
.wo-status{position:absolute;right:40px;top:30px;text-align:right}
.wo-clock{font-size:34px;font-weight:300;letter-spacing:-.02em;line-height:1}
.wo-sync{font-size:11px;color:var(--muted);margin-top:4px}
.wo-sync.err{color:#b4532a}
.wo-plates{position:absolute;left:${PL}px;top:${PT}px;width:${PS}px;height:${PS}px;touch-action:pan-y}
.wo-orbit{position:absolute;inset:0;transform-origin:69% -217%;visibility:hidden;will-change:transform}
.wo-plate{width:${PS}px;height:${PS}px;border-radius:50%;overflow:hidden;background:#e9e1d6;
  box-shadow:0 22px 34px -12px rgba(60,40,20,.38),0 4px 8px rgba(60,40,20,.14),0 0 0 8px rgba(255,255,255,.75)}
.wo-plate img{width:100%;height:100%;object-fit:cover;display:block;-webkit-user-drag:none}
.wo-cutlery{width:84px;height:84px;fill:none;stroke:#b9ad9f;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.wo-plate.empty{display:grid;place-items:center;color:var(--muted);font-size:15px;text-align:center;line-height:1.4}
.wo-head{position:absolute;left:432px;top:118px;width:min(380px,calc(var(--wo-w,${W}px) - 432px - 246px));height:230px}
.wo-hd{position:absolute;inset:0;visibility:hidden}
.wo-eye{font-size:14px;font-weight:600;margin:0 0 10px 2px;color:#5e554c}
.wo-t1,.wo-t2{display:block;margin:0;text-transform:uppercase;line-height:.98}
.wo-t1{font-weight:800;letter-spacing:-.025em;color:#2b2622}
.wo-t2{font-weight:200;letter-spacing:-.01em;margin-top:8px}
.wo-card{position:absolute;right:30px;top:150px;width:186px;padding:18px 18px 20px;border-radius:20px;background:var(--card);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 18px 40px -24px rgba(0,0,0,.25)}
.wo-bodies{display:grid}
.wo-body{grid-area:1/1;visibility:hidden}
.wo-lbl{font-size:11px;color:var(--muted);margin:0}
.wo-cook{font-size:24px;font-weight:600;letter-spacing:-.01em;margin:2px 0 14px;display:flex;align-items:center;gap:8px}
.wo-dot{width:10px;height:10px;border-radius:50%}
.wo-time{font-size:17px;font-weight:500;margin:2px 0 14px}
.wo-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.wo-chips li{font-size:12px;padding:5px 10px;border-radius:99px;background:rgba(43,38,34,.07)}
.wo-strip{position:absolute;left:96px;right:40px;top:452px;height:112px;display:flex;align-items:center;gap:14px}
.wo-today{flex:none;width:92px;height:92px;border-radius:18px;font-size:13px;font-weight:600;display:grid;place-items:center;
  background:rgba(255,255,255,.55);transition:opacity .4s,transform .4s}
.wo-today[hidden]{display:grid;opacity:0;pointer-events:none;transform:scale(.9)}
.wo-tiles{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.wo-tile{display:flex;align-items:center;gap:14px;height:96px;padding:0 16px 0 12px;border-radius:20px;text-align:left;transition:background .45s,box-shadow .45s}
.wo-tile[aria-current]{background:rgba(255,255,255,.72);box-shadow:0 10px 24px -16px rgba(0,0,0,.3)}
.wo-thumb{flex:none;width:66px;height:66px;border-radius:50%;overflow:hidden;background:#e9e1d6;box-shadow:0 4px 8px rgba(60,40,20,.18);transition:transform .45s}
.wo-tile[aria-current] .wo-thumb{transform:scale(1.06)}
.wo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.wo-tt{min-width:0}
.wo-tday{font-size:12px;font-weight:600;color:#5e554c}
.wo-tname{font-size:15px;font-weight:500;line-height:1.2;margin:2px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wo-tcook{font-size:11px;color:var(--muted)}
.wo-note{display:flex;align-items:center;gap:8px;margin:16px 0 0 2px;padding:7px 14px 7px 10px;border-radius:99px;width:max-content;max-width:300px;
  background:rgba(255,255,255,.66);font-size:14px;font-weight:500;color:#5e554c}
.wo-note span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wo-nico{flex:none;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.wo-thumb{display:grid;place-items:center}
.wo-tico{width:30px;height:30px;fill:none;stroke:#b9ad9f;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.wo-tcook{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wo-cta{display:block;width:100%;margin-top:16px;padding:10px 12px;border-radius:99px;background:#2b2622;color:#f4efe8;font-size:14px;font-weight:600;text-decoration:none;text-align:center;line-height:1.25}
.wo-cta2{display:block;margin-top:10px;text-align:center;font-size:13px;font-weight:600;color:#7a6f65;text-decoration:underline;text-underline-offset:3px}
.wo-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.wo-tile,.wo-thumb,.wo-today{transition:none}}
`

const NOTE_ICON = (cls: string) => (
  <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5" /></svg>
)
const CUTLERY = <svg className="wo-cutlery" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1-3 4-3 7 0 2 1 3 3 3" /></svg>

const COOK_COLOR: Record<string, string> = { Riem: "#e0895e", Kuhn: "#6f9fc6" }

/** Kleine Zeile unter dem Namen in der Leiste: wer kocht, Notiz. */
function tileMeta(d: Day): string {
  if (d.dish) return [d.dish.cook, d.note ? "Notiz: " + d.note.text : null].filter(Boolean).join(" · ")
  if (d.note) return d.note.cook ? d.note.cook + " · Notiz" : "Notiz"
  return ""
}

type Props = {
  days: Day[]
  syncLabel: string
  syncError?: boolean
  now: Date
}

export function WochenplanOrbit({ days, syncLabel, syncError, now }: Props) {
  const n = days.length
  const [index, setIndex] = useState(0)
  const [openDish, setOpenDish] = useState<Dish | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const orbits = useRef<(HTMLDivElement | null)[]>([])
  const heads = useRef<(HTMLDivElement | null)[]>([])
  const bodies = useRef<(HTMLDivElement | null)[]>([])
  const arcRef = useRef<SVGPathElement | null>(null)
  const arc = useRef({ a0: 0, a1: 0 })
  const shown = useRef(-1)
  const dirRef = useRef<1 | -1>(1)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const reducedRef = useRef(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const returnTimer = useRef<number | undefined>(undefined)

  // Bühne auf den Bildschirm einpassen
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Skaliert nach der Höhe, die Bühne wird bei breiteren Bildschirmen breiter (bis 1180 px), damit links und rechts kein leerer Rand bleibt.
    const fit = () => {
      const s = Math.min(el.clientWidth / W, el.clientHeight / H)
      el.style.setProperty("--wo-s", String(s))
      el.style.setProperty("--wo-w", Math.min(1180, Math.max(W, el.clientWidth / s)) + "px")
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => (reducedRef.current = mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  // Der Wechsel: alle Tage stehen im DOM, GSAP bewegt nur den alten und den neuen.
  useLayoutEffect(() => {
    const from = shown.current
    const to = Math.min(index, n - 1)
    const parts = (i: number) => {
      const head = heads.current[i]
      return {
        orbit: orbits.current[i],
        head,
        eye: head?.querySelector(".wo-eye") ?? null,
        t1: head?.querySelector(".wo-t1") ?? null,
        t2: head?.querySelector(".wo-t2") ?? null,
        body: bodies.current[i],
      }
    }
    const drawArc = () => arcRef.current?.setAttribute("d", arcPath(arc.current.a0, arc.current.a1))
    const rest = ARC_REST[to % ARC_REST.length]
    const tint = accentFor(days[to]?.dish?.diet)
    if (tlRef.current) tlRef.current.progress(1).kill()
    const b = parts(to)
    if (from === -1 || from === to || from >= n || reducedRef.current) {
      for (let i = 0; i < n; i++) if (i !== to) {
        const p = parts(i)
        gsap.set([p.orbit, p.head, p.body].filter(Boolean), { autoAlpha: 0 })
      }
      gsap.set([b.orbit, b.head, b.body, b.eye].filter(Boolean), { autoAlpha: 1, rotation: 0, y: 0 })
      gsap.set([b.t1, b.t2].filter(Boolean), { clipPath: SHOW })
      arc.current.a0 = rest[0]
      arc.current.a1 = rest[1]
      drawArc()
      if (arcRef.current) gsap.set(arcRef.current, { fill: tint })
      shown.current = to
      return
    }
    const a = parts(from)
    const d = dirRef.current
    const tl = gsap.timeline({ onComplete: () => { tlRef.current = null } })
    tlRef.current = tl
    tl.to(a.orbit, { rotation: SWING * d, duration: 0.62, ease: "power2.in" }, 0)
      .set(a.orbit, { autoAlpha: 0, rotation: 0 }, 0.62)
      .fromTo(b.orbit, { autoAlpha: 1, rotation: -SWING * d }, { rotation: 0, duration: 0.95, ease: "power3.out" }, 0.3)
    tl.to(a.t1, { clipPath: HIDE_1, duration: 0.42, ease: "power2.in" }, 0)
    if (a.t2) tl.to(a.t2, { clipPath: HIDE_2, duration: 0.42, ease: "power2.in" }, 0.06)
    tl.to(a.eye, { autoAlpha: 0, duration: 0.25 }, 0)
      .set(a.head, { autoAlpha: 0 }, 0.5)
      .set(b.head, { autoAlpha: 1 }, 0.5)
      .fromTo(b.eye, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.55)
      .fromTo(b.t1, { clipPath: HIDE_1 }, { clipPath: SHOW, duration: 0.7, ease: "power3.out" }, 0.55)
    if (b.t2) tl.fromTo(b.t2, { clipPath: HIDE_2 }, { clipPath: SHOW, duration: 0.7, ease: "power3.out" }, 0.62)
    tl.to(a.body, { autoAlpha: 0, y: -6, duration: 0.3, ease: "power1.in" }, 0.05)
      .set(b.body, { autoAlpha: 1, y: 0 }, 0.4)
    if (b.body) tl.fromTo(b.body.children, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" }, 0.4)
    tl.to(arc.current, { a0: ARC_SWEEP[0], a1: ARC_SWEEP[1], duration: 0.6, ease: "power2.inOut", onUpdate: drawArc }, 0)
      .to(arc.current, { a0: rest[0], a1: rest[1], duration: 0.85, ease: "power3.out", onUpdate: drawArc }, 0.6)
    if (arcRef.current) tl.to(arcRef.current, { fill: tint, duration: 1.1, ease: "power1.inOut" }, 0.1)
    shown.current = to
  }, [index, n, days])

  useEffect(() => () => { tlRef.current?.kill(); window.clearTimeout(returnTimer.current) }, [])

  const go = (to: number) => {
    const next = Math.max(0, Math.min(n - 1, to))
    window.clearTimeout(returnTimer.current)
    if (next !== 0) returnTimer.current = window.setTimeout(() => go(0), RETURN_MS)
    if (next === index) return
    dirRef.current = next > index ? 1 : -1
    setIndex(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1) }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1) }
  }
  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.4) go(index + (dx < 0 ? 1 : -1))
    // Tippen auf den Teller öffnet das Rezept
    else if (Math.abs(dx) < 10 && Math.abs(e.clientY - s.y) < 10 && (e.target as HTMLElement).closest?.(".wo-plates")) openRecipe()
  }

  // Rezept öffnen: solange es offen ist, kein automatisches Zurückspringen.
  const openRecipe = () => {
    const dish = days[index]?.dish
    if (!dish) return
    sheetDir.current = 0
    window.clearTimeout(returnTimer.current)
    setOpenDish(dish)
  }
  const closeRecipe = () => {
    setOpenDish(null)
    if (index !== 0) returnTimer.current = window.setTimeout(() => go(0), RETURN_MS)
  }
  // In der Rezeptansicht zum Rezept des nächsten/vorigen Tages wischen.
  const sheetDir = useRef<1 | -1 | 0>(0)
  const switchRecipe = (dir: 1 | -1) => {
    const to = index + dir
    if (to < 0 || to >= n) return
    dirRef.current = dir
    sheetDir.current = dir
    setIndex(to)
    const dish = days[to].dish
    if (dish) setOpenDish(dish)
    else closeRecipeAt(to)
  }
  const closeRecipeAt = (to: number) => {
    setOpenDish(null)
    window.clearTimeout(returnTimer.current)
    if (to !== 0) returnTimer.current = window.setTimeout(() => go(0), RETURN_MS)
  }

  const clock = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
  const current = days[index]

  return (
    <div ref={rootRef} className="wo-root" tabIndex={0} onKeyDown={onKeyDown} role="region" aria-label="Wochenplan">
      <style>{"@font-face{font-family:wo-face;src:url(./outfit.woff2) format('woff2');font-weight:100 900;font-display:swap}" + CSS}</style>
      <div className="wo-canvas" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
        <svg className="wo-arc" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <path ref={arcRef} style={{ opacity: 0.38 }} />
        </svg>

        <div className="wo-status">
          <div className="wo-clock">{clock}</div>
          <div className={"wo-sync" + (syncError ? " err" : "")}>{syncLabel}</div>
        </div>

        <div className="wo-plates" style={{ cursor: days[index]?.dish ? "pointer" : "default" }}>
          {days.map((d, i) => (
            <div key={d.date} ref={(el) => { orbits.current[i] = el }} className="wo-orbit" aria-hidden={i !== index}>
              {d.dish?.image ? (
                <div className="wo-plate"><img src={d.dish.image} alt={d.dish.name} draggable={false} /></div>
              ) : (
                <div className="wo-plate empty">{d.dish ? d.dish.name : d.note ? NOTE_ICON("wo-cutlery") : CUTLERY}</div>
              )}
            </div>
          ))}
        </div>

        <div className="wo-head" aria-live="polite" onClick={openRecipe} style={{ cursor: days[index]?.dish ? "pointer" : "default" }}>
          {days.map((d, i) => {
            const [t1, t2] = d.dish ? splitTitle(d.dish.name) : d.note ? [d.note.text, "Notiz"] : ["Noch nichts", "geplant"]
            const longest1 = Math.max(...t1.split(" ").map((w) => w.length))
            return (
              <div key={d.date} ref={(el) => { heads.current[i] = el }} className="wo-hd" aria-hidden={i !== index}>
                <p className="wo-eye">{eyebrow(d.date, d.weekday, now)}</p>
                <h2 style={{ margin: 0, font: "inherit" }}>
                  <span className="wo-t1" style={{ fontSize: fitSize(Math.max(longest1, t1.length / 2), 56, 26, 290, 0.8) + "px" }}>{t1}</span>
                  {t2 ? <span className="wo-t2" style={{ fontSize: fitSize(t2.length / 1.6, 30, 17, 300, 0.56) + "px" }}>{t2}</span> : null}
                </h2>
                {d.dish && d.note ? <p className="wo-note">{NOTE_ICON("wo-nico")}<span>{d.note.text}</span></p> : null}
              </div>
            )
          })}
        </div>

        <div className="wo-card">
          <div className="wo-bodies">
            {days.map((d, i) => {
              const dish = d.dish
              const time = minutesLabel(dish?.totalMinutes ?? null)
              return (
                <div key={d.date} ref={(el) => { bodies.current[i] = el }} className="wo-body" aria-hidden={i !== index}>
                  {dish ? (
                    <>
                      <div>
                        <p className="wo-lbl">Kocht</p>
                        <p className="wo-cook">
                          {dish.cook ? <span className="wo-dot" style={{ background: COOK_COLOR[dish.cook] ?? "#aaa" }} /> : null}
                          {dish.cook ?? "Offen"}
                        </p>
                      </div>
                      {time ? <div><p className="wo-lbl">Gesamtzeit</p><p className="wo-time">{time}</p></div> : null}
                      {dish.kcal || dish.protein ? (
                        <ul className="wo-chips">
                          {dish.kcal ? <li>{dish.kcal} kcal</li> : null}
                          {dish.protein ? <li>{dish.protein} g Eiweiß</li> : null}
                        </ul>
                      ) : null}
                      <div>
                        <button type="button" className="wo-btn wo-cta" tabIndex={i === index ? 0 : -1} onClick={openRecipe}>Rezept öffnen ›</button>
                        <a className="wo-cta2" href={PLAN_URL} target="_blank" rel="noreferrer" tabIndex={i === index ? 0 : -1}>Im Kochbuch ändern</a>
                      </div>
                    </>
                  ) : d.note ? (
                    <>
                      <div>
                        <p className="wo-lbl">Kocht</p>
                        <p className="wo-cook">
                          {d.note.cook ? <span className="wo-dot" style={{ background: COOK_COLOR[d.note.cook] ?? "#aaa" }} /> : null}
                          {d.note.cook ?? "Offen"}
                        </p>
                      </div>
                      <div><p className="wo-lbl">Wochenplan</p><p className="wo-time">Notiz, noch kein Rezept</p></div>
                      <div><a className="wo-cta" href={PLAN_URL} target="_blank" rel="noreferrer" tabIndex={i === index ? 0 : -1}>Im Kochbuch eintragen ›</a></div>
                    </>
                  ) : (
                    <>
                      <div><p className="wo-lbl">Wochenplan</p><p className="wo-time">Noch kein Gericht eingetragen.</p></div>
                      <div><a className="wo-cta" href={PLAN_URL} target="_blank" rel="noreferrer" tabIndex={i === index ? 0 : -1}>Im Kochbuch eintragen ›</a></div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="wo-strip">
          <button type="button" className="wo-btn wo-today" hidden={index === 0} onClick={() => go(0)} aria-label="Zurück zum ersten Tag">
            ← {shortLabel(days[0].date, days[0].weekday, now)}
          </button>
          <div className="wo-tiles">
            {days.slice(1).map((d, j) => {
              const i = j + 1
              return (
                <button key={d.date} type="button" className="wo-btn wo-tile" aria-current={i === index ? "true" : undefined} onClick={() => go(i === index ? 0 : i)}>
                  <span className="wo-thumb">{d.dish?.image ? <img src={d.dish.image} alt="" draggable={false} /> : d.note && !d.dish ? NOTE_ICON("wo-tico") : null}</span>
                  <span className="wo-tt">
                    <span className="wo-tday" style={{ display: "block" }}>{shortLabel(d.date, d.weekday, now)}</span>
                    <span className="wo-tname">{d.dish?.name ?? d.note?.text ?? "Noch nichts geplant"}</span>
                    {tileMeta(d) ? <span className="wo-tcook">{tileMeta(d)}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {openDish ? (
        <RecipeSheet
          key={days[index]?.date}
          dish={openDish}
          dayLabel={eyebrow(days[index].date, days[index].weekday, now)}
          enterFrom={sheetDir.current}
          canPrev={index > 0}
          canNext={index < n - 1}
          onSwipeDay={switchRecipe}
          onClose={() => { sheetDir.current = 0; closeRecipe() }}
        />
      ) : null}
      <p className="wo-sr" aria-live="polite">{current ? `${current.weekday}: ${current.dish?.name ?? current.note?.text ?? "noch nichts geplant"}` : ""}</p>
    </div>
  )
}
