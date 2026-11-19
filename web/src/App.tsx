import { useCallback, useEffect, useRef, useState } from "react"
import { berlinToday, demoPlan, fetchPlan, isCacheUsable, readCache, writeCache, type Plan } from "./data"
import { WochenplanOrbit } from "./WochenplanOrbit"

const REFRESH_MS = 5 * 60_000
const params = new URLSearchParams(location.search)
const DEMO = params.has("demo")
const KEY_STORE = "wochenplan-key"

/**
 * Schlüssel aus der Adresse übernehmen und merken, damit die installierte App
 * ohne ?key=… startet (der Schlüssel steht so nicht im öffentlichen Manifest).
 */
function resolveKey(): string {
  const fromUrl = params.get("key")
  try {
    if (fromUrl) {
      localStorage.setItem(KEY_STORE, fromUrl)
      history.replaceState(null, "", location.pathname) // Schlüssel aus der Adresszeile entfernen
      return fromUrl
    }
    return localStorage.getItem(KEY_STORE) ?? ""
  } catch {
    return fromUrl ?? ""
  }
}
const KEY = DEMO ? "" : resolveKey()

/** Display anlassen, solange die Seite sichtbar ist (Screen Wake Lock). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }
    if (!nav.wakeLock) return
    let lock: Sentinel | null = null
    const acquire = () => {
      if (document.visibilityState === "visible") nav.wakeLock!.request("screen").then((l) => (lock = l)).catch(() => {})
    }
    acquire()
    document.addEventListener("visibilitychange", acquire)
    return () => {
      document.removeEventListener("visibilitychange", acquire)
      lock?.release().catch(() => {})
    }
  }, [])
}

function syncText(at: number | null, now: number): string {
  if (!at) return "Wird geladen …"
  const min = Math.floor((now - at) / 60_000)
  return min < 1 ? "Gerade aktualisiert" : `Aktualisiert vor ${min} Min.`
}

export default function App() {
  const [plan, setPlan] = useState<Plan | null>(() => (DEMO ? demoPlan() : isCacheUsable(readCache()) ? readCache() : null))
  const [syncedAt, setSyncedAt] = useState<number | null>(() => (plan ? Date.parse(plan.generatedAt) || null : null))
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const lastDay = useRef(berlinToday())
  const busy = useRef(false)
  useWakeLock()

  const refresh = useCallback(async () => {
    if (DEMO) { setPlan(demoPlan()); setSyncedAt(Date.now()); return }
    if (!KEY || busy.current) return
    busy.current = true
    try {
      const fresh = await fetchPlan(KEY)
      setPlan(fresh)
      writeCache(fresh)
      setSyncedAt(Date.now())
      setError(null)
    } catch (e) {
      setError(e instanceof TypeError ? "Keine Verbindung" : e instanceof Error ? e.message : "Abruf fehlgeschlagen")
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const poll = window.setInterval(refresh, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", refresh)
    // Uhr + Tageswechsel
    const tick = window.setInterval(() => {
      const d = new Date()
      setNow(d)
      const today = berlinToday(d)
      if (today !== lastDay.current) { lastDay.current = today; refresh() }
    }, 20_000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", refresh)
    }
  }, [refresh])

  if (!KEY && !DEMO) {
    return <Message title="Dashboard-Schlüssel fehlt" text="Einmal die Adresse mit ?key=… öffnen, danach merkt sich das Tablet den Schlüssel." />
  }
  if (!plan?.days?.length) {
    return <Message title={error ? "Wochenplan gerade nicht erreichbar" : "Wochenplan wird geladen …"} text={error ?? ""} />
  }

  const label = error ? `Offline · Stand: ${syncText(syncedAt, now.getTime()).replace("Aktualisiert ", "")}` : syncText(syncedAt, now.getTime())
  return <WochenplanOrbit key={plan.days[0].date} days={plan.days} now={now} syncLabel={label} syncError={!!error} />
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "inherit", opacity: 0.8, textAlign: "center" }}>
      <div><div style={{ fontSize: 24, fontWeight: 600 }}>{title}</div><div style={{ marginTop: 8 }}>{text}</div></div>
    </div>
  )
}
