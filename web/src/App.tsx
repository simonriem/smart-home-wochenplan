import { useCallback, useEffect, useRef, useState } from "react"
import { berlinToday, demoPlan, fetchPlan, isCacheUsable, readCache, writeCache, type Plan } from "./data"
import { WochenplanOrbit } from "./WochenplanOrbit"

const REFRESH_MS = 5 * 60_000
const params = new URLSearchParams(location.search)
const KEY = params.get("key") ?? ""
const DEMO = params.has("demo")

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
      setError(e instanceof Error ? e.message : "Abruf fehlgeschlagen")
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
    return <Message title="Dashboard-Schlüssel fehlt" text="Die Adresse muss ?key=… enthalten." />
  }
  if (!plan?.days?.length) {
    return <Message title={error ? "Wochenplan gerade nicht erreichbar" : "Wochenplan wird geladen …"} text={error ?? ""} />
  }

  const label = error ? `Offline · Stand: ${syncText(syncedAt, now.getTime()).replace("Aktualisiert ", "")}` : syncText(syncedAt, now.getTime())
  return <WochenplanOrbit key={plan.days[0].date} days={plan.days} now={now} syncLabel={label} syncError={!!error} />
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#5e554c", textAlign: "center" }}>
      <div><div style={{ fontSize: 24, fontWeight: 600 }}>{title}</div><div style={{ marginTop: 8 }}>{text}</div></div>
    </div>
  )
}
