import { useEffect, useRef, useState } from "react"
import { minutesLabel, PLAN_URL, type Dish } from "./data"
import { clock, findDurations } from "./durations"

/*
 * Rezeptansicht über dem Dashboard: Übersicht (Zutaten zum Abhaken + alle Schritte)
 * und Kochmodus (ein Schritt pro Bildschirm, große Schrift, Timer aus den Zeitangaben).
 */

type Timer = { id: number; label: string; endsAt: number; total: number; done: boolean }

const CSS = `
.rs{position:absolute;inset:0;z-index:20;background:#f4efe8;color:#2b2622;display:flex;flex-direction:column;
  font-family:wo-face,ui-sans-serif,system-ui,sans-serif;animation:rs-in .35s cubic-bezier(.2,.8,.2,1)}
@keyframes rs-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.rs.from-right{animation:rs-r .4s cubic-bezier(.2,.8,.2,1)}
.rs.from-left{animation:rs-l .4s cubic-bezier(.2,.8,.2,1)}
@keyframes rs-r{from{opacity:.3;transform:translateX(70px)}to{opacity:1;transform:none}}
@keyframes rs-l{from{opacity:.3;transform:translateX(-70px)}to{opacity:1;transform:none}}
.rs-day{font-size:13px;font-weight:700;color:#8a8178;margin-bottom:2px;display:flex;align-items:center;gap:10px}
.rs-dots{display:inline-flex;gap:4px;color:#c9bdb0;font-size:16px;letter-spacing:2px}
.rs-edit{font-size:13px;font-weight:600;color:#7a6f65;text-decoration:underline;text-underline-offset:3px}
.rs *{box-sizing:border-box}
.rs-btn{appearance:none;border:0;font:inherit;color:inherit;cursor:pointer;background:rgba(43,38,34,.07);border-radius:99px;
  padding:12px 20px;font-size:17px;font-weight:600;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.rs-btn.primary{background:#2b2622;color:#f4efe8}
.rs-btn.ghost{background:none}
.rs-ico{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.rs-top{display:flex;align-items:center;gap:16px;padding:18px 26px 14px}
.rs-thumb{width:64px;height:64px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 4px 10px rgba(60,40,20,.2)}
.rs-title{flex:1;min-width:0}
.rs-title h2{margin:0;font-size:28px;font-weight:700;letter-spacing:-.01em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-meta{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
.rs-meta span{font-size:14px;padding:4px 11px;border-radius:99px;background:rgba(255,255,255,.7)}
.rs-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);gap:22px;padding:4px 26px 22px}
.rs-panel{background:rgba(255,255,255,.6);border-radius:22px;padding:18px 20px;overflow:auto;-webkit-overflow-scrolling:touch}
.rs-h{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a8178;margin:0 0 10px}
.rs-ing{list-style:none;margin:0;padding:0}
.rs-ing li{display:flex;align-items:flex-start;gap:12px;padding:10px 4px;font-size:18px;line-height:1.3;border-bottom:1px solid rgba(43,38,34,.07);cursor:pointer}
.rs-ing li:last-child{border-bottom:0}
.rs-box{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid #c9bdb0;display:grid;place-items:center;margin-top:1px}
.rs-ing li.on{color:#a59a8f;text-decoration:line-through}
.rs-ing li.on .rs-box{background:#8fb07a;border-color:#8fb07a}
.rs-ing li.on .rs-box::after{content:"";width:6px;height:11px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg) translate(-1px,-1px)}
.rs-steps{list-style:none;margin:0;padding:0;counter-reset:st}
.rs-steps li{display:flex;gap:14px;padding:12px 4px;font-size:18px;line-height:1.45;border-bottom:1px solid rgba(43,38,34,.07)}
.rs-steps li:last-child{border-bottom:0}
.rs-num{flex:none;width:30px;height:30px;border-radius:50%;background:#2b2622;color:#f4efe8;font-size:14px;font-weight:700;display:grid;place-items:center}
.rs-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.rs-chip{appearance:none;border:0;font:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:99px;
  background:#f6a37c33;color:#8a4a2b;font-size:15px;font-weight:600}
.rs-tip{margin-top:16px;padding:14px 16px;border-radius:16px;background:#fff6dc;font-size:16px;line-height:1.4}
.rs-timers{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.rs-timer{display:inline-flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-radius:99px;background:#2b2622;color:#f4efe8;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.rs-timer small{font-weight:400;opacity:.7;font-size:13px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rs-timer button{appearance:none;border:0;background:rgba(255,255,255,.15);color:inherit;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px}
.rs-timer.done{background:#d9603b;animation:rs-pulse 1s infinite}
@keyframes rs-pulse{50%{transform:scale(1.06)}}
.rs-cook{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;padding:4px 26px 22px}
.rs-cook.with-ing{grid-template-columns:minmax(0,1fr) 300px}
.rs-stage{display:flex;flex-direction:column;min-height:0;background:rgba(255,255,255,.6);border-radius:26px;padding:26px 34px;touch-action:pan-y}
.rs-progress{height:6px;border-radius:6px;background:rgba(43,38,34,.08);overflow:hidden;margin-bottom:14px}
.rs-progress i{display:block;height:100%;background:#e0895e;transition:width .4s}
.rs-stepno{font-size:15px;font-weight:700;color:#8a8178;letter-spacing:.04em;text-transform:uppercase}
.rs-steptext{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;font-size:clamp(26px,3.3vw,40px);line-height:1.35;font-weight:500;letter-spacing:-.005em;padding:10px 0}
.rs-steptext p{margin:0}
.rs-nav{display:flex;justify-content:space-between;align-items:center;gap:16px}
.rs-nav .rs-btn{padding:18px 30px;font-size:20px}
.rs-cook .rs-chip{font-size:19px;padding:11px 20px}
.rs-side{overflow:auto}
`

const ICON = {
  close: <svg className="rs-ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>,
  play: <svg className="rs-ico" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" /></svg>,
  list: <svg className="rs-ico" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  timer: <svg className="rs-ico" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>,
  left: <svg className="rs-ico" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>,
  right: <svg className="rs-ico" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>,
  ext: <svg className="rs-ico" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
}

/** Kurzer Signalton (WebAudio, kein Audiofile nötig). */
function beep(ctx: AudioContext | null) {
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, t + i * 0.35)
    g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.35 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.35 + 0.25)
    o.connect(g).connect(ctx.destination)
    o.start(t + i * 0.35)
    o.stop(t + i * 0.35 + 0.3)
  }
  navigator.vibrate?.([300, 150, 300])
}

type Props = {
  dish: Dish
  dayLabel: string
  /** Woher die Ansicht hereinkommt: 0 = von unten (geöffnet), 1/-1 = vom Wischen zum nächsten/vorigen Tag */
  enterFrom: 1 | -1 | 0
  canPrev: boolean
  canNext: boolean
  onSwipeDay: (dir: 1 | -1) => void
  onClose: () => void
}

export function RecipeSheet({ dish, dayLabel, enterFrom, canPrev, canNext, onSwipeDay, onClose }: Props) {
  const [mode, setMode] = useState<"overview" | "cook">("overview")
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [showIng, setShowIng] = useState(false)
  const [timers, setTimers] = useState<Timer[]>([])
  const [, setTick] = useState(0)
  const audio = useRef<AudioContext | null>(null)
  const nextId = useRef(1)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const steps = dish.steps ?? []
  const ingredients = dish.ingredients ?? []
  const n = steps.length

  // Sekundentakt für laufende Timer; abgelaufene klingeln alle 4 s, bis man sie wegtippt (max. 2 Min.).
  useEffect(() => {
    if (!timers.length) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setTimers((list) => list.map((t) => {
        if (!t.done && now >= t.endsAt) { beep(audio.current); return { ...t, done: true } }
        if (t.done && now - t.endsAt < 120_000 && Math.floor((now - t.endsAt) / 1000) % 4 === 0) beep(audio.current)
        return t
      }))
      setTick((x) => x + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [timers.length])

  useEffect(() => () => { audio.current?.close().catch(() => {}) }, [])

  const startTimer = (seconds: number, label: string) => {
    try {
      // Audio darf erst nach einer Berührung starten – der Tipp auf den Timer ist sie.
      audio.current ??= new AudioContext()
      audio.current.resume().catch(() => {})
    } catch { /* kein Audio – dann nur Vibration/Anzeige */ }
    setTimers((list) => [...list, { id: nextId.current++, label, endsAt: Date.now() + seconds * 1000, total: seconds, done: false }])
  }
  const stopTimer = (id: number) => setTimers((list) => list.filter((t) => t.id !== id))

  const go = (to: number) => setStep(Math.max(0, Math.min(n - 1, to)))
  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY } }
  /** Wischen: im Kochmodus = Schritte, in der Übersicht = Rezept des nächsten/vorigen Tages. */
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(e.clientY - s.y) * 1.4) return
    const dir = dx < 0 ? 1 : -1
    if (mode === "cook") go(step + dir)
    else if (dir === 1 ? canNext : canPrev) onSwipeDay(dir)
  }

  const chips = (text: string, stepIndex: number) => {
    const found = findDurations(text)
    if (!found.length) return null
    return (
      <div className="rs-chips">
        {found.map((d) => (
          <button key={d.text} type="button" className="rs-chip" onClick={() => startTimer(d.seconds, `Schritt ${stepIndex + 1}`)}>
            {ICON.timer}{d.text}
          </button>
        ))}
      </div>
    )
  }

  const ingredientList = (
    <ul className="rs-ing">
      {ingredients.map((x, i) => (
        <li key={i} className={checked[i] ? "on" : ""} onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}>
          <span className="rs-box" />{x}
        </li>
      ))}
    </ul>
  )

  const time = minutesLabel(dish.totalMinutes)
  const now = Date.now()

  return (
    <div className={"rs" + (enterFrom === 1 ? " from-right" : enterFrom === -1 ? " from-left" : "")} role="dialog" aria-label={`Rezept: ${dish.name}`}>
      <style>{CSS}</style>
      <div className="rs-top">
        {dish.image ? <img className="rs-thumb" src={dish.image} alt="" /> : null}
        <div className="rs-title">
          <div className="rs-day">
            <span>{canPrev && mode === "overview" ? "‹ " : ""}{dayLabel}{canNext && mode === "overview" ? " ›" : ""}</span>
            <a className="rs-edit" href={PLAN_URL} target="_blank" rel="noreferrer">Im Kochbuch ändern</a>
          </div>
          <h2>{dish.name}</h2>
          <div className="rs-meta">
            {time ? <span>{time}</span> : null}
            {dish.servings ? <span>{dish.servings} Portionen</span> : null}
            {dish.cook ? <span>Kocht: {dish.cook}</span> : null}
          </div>
        </div>
        {timers.length ? (
          <div className="rs-timers">
            {timers.map((t) => (
              <span key={t.id} className={"rs-timer" + (t.done ? " done" : "")}>
                {t.done ? "Fertig!" : clock((t.endsAt - now) / 1000)}<small>{t.label}</small>
                <button type="button" aria-label="Timer beenden" onClick={() => stopTimer(t.id)}>×</button>
              </span>
            ))}
          </div>
        ) : null}
        {mode === "overview" ? (
          n ? <button type="button" className="rs-btn primary" onClick={() => setMode("cook")}>{ICON.play}Kochmodus</button> : null
        ) : (
          <>
            <button type="button" className="rs-btn" onClick={() => setShowIng((v) => !v)}>{ICON.list}Zutaten</button>
            <button type="button" className="rs-btn" onClick={() => setMode("overview")}>Übersicht</button>
          </>
        )}
        <button type="button" className="rs-btn ghost" aria-label="Schließen" onClick={onClose}>{ICON.close}</button>
      </div>

      {mode === "overview" ? (
        <div className="rs-body" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)} style={{ touchAction: "pan-y" }}>
          <div className="rs-panel">
            <p className="rs-h">Zutaten</p>
            {ingredients.length ? ingredientList : <p>Keine Zutaten hinterlegt.</p>}
            {dish.url ? (
              <p style={{ marginTop: 18 }}>
                <a className="rs-btn" href={dish.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{ICON.ext}Im Kochbuch öffnen</a>
              </p>
            ) : null}
          </div>
          <div className="rs-panel">
            <p className="rs-h">Zubereitung</p>
            {n ? (
              <ol className="rs-steps">
                {steps.map((s, i) => (
                  <li key={i}><span className="rs-num">{i + 1}</span><div>{s}{chips(s, i)}</div></li>
                ))}
              </ol>
            ) : <p>Keine Schritte hinterlegt.</p>}
            {dish.tip ? <div className="rs-tip"><b>Tipp:</b> {dish.tip}</div> : null}
          </div>
        </div>
      ) : (
        <div className={"rs-cook" + (showIng ? " with-ing" : "")}>
          <div className="rs-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
            <div className="rs-progress"><i style={{ width: `${((step + 1) / n) * 100}%` }} /></div>
            <div className="rs-stepno">Schritt {step + 1} von {n}</div>
            <div className="rs-steptext"><div><p>{steps[step]}</p>{chips(steps[step], step)}</div></div>
            <div className="rs-nav">
              <button type="button" className="rs-btn" onClick={() => go(step - 1)} style={{ visibility: step === 0 ? "hidden" : "visible" }}>{ICON.left}Zurück</button>
              {step < n - 1 ? (
                <button type="button" className="rs-btn primary" onClick={() => go(step + 1)}>Weiter{ICON.right}</button>
              ) : (
                <button type="button" className="rs-btn primary" onClick={onClose}>Fertig – guten Appetit</button>
              )}
            </div>
          </div>
          {showIng ? <div className="rs-panel rs-side"><p className="rs-h">Zutaten</p>{ingredientList}</div> : null}
        </div>
      )}
    </div>
  )
}
