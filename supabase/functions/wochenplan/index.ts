// Edge Function "wochenplan" – liest den gemeinsamen Wochenplan der Kochbuch-Seite
// (bunkyo-kochbuch.vercel.app) NUR LESEND und liefert dem Tablet-Dashboard eine
// schlanke Liste: Haupttag + die drei folgenden Tage, je mit dem ersten Gericht.
//
// Ruft ausschließlich auf: POST /api/admin/login, GET /api/weekly-plan/load,
// GET /recipes/<slug>.json. Den Speicher-Endpunkt der Website nutzt sie nie.

const SITE = "https://bunkyo-kochbuch.vercel.app";
const PLAN_KEY = "team-default";
const COOKIE_NAME = "bunkyo_admin_session";
const RESPONSE_TTL_MS = 60_000; // Antwort 1 Min. zwischenspeichern
const RECIPE_TTL_MS = 6 * 60 * 60_000; // Rezeptdateien 6 Std.
const EVENING_HOUR = 18; // ab dann: ist heute schon gelöscht → "Morgen" wird groß

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-dashboard-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type PlannedRecipe = { recipeSlug?: string; recipeName?: string; cookFamily?: string; isNote?: boolean };
type DayPlan = { day?: string; recipes?: PlannedRecipe[] };

export type Dish = {
  name: string;
  slug: string | null;
  image: string | null;
  totalMinutes: number | null;
  kcal: number | null;
  protein: number | null;
  diet: string | null;
  cook: string | null;
};

export type DayOut = { date: string; weekday: string; dish: Dish | null };

let sessionCookie: string | null = null;
let responseCache: { at: number; body: string } | null = null;
const recipeCache = new Map<string, { at: number; data: Record<string, unknown> | null }>();

// ---------- reine Hilfsfunktionen (auch für Tests) ----------

/** ISO-8601-Dauer wie "PT1H30M" → Minuten. */
export function isoMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const total = (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
  return total > 0 ? total : null;
}

/** "540 kcal" / "32 g" / 540 → 540 */
export function firstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const m = value.replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

/** Datum + Wochentag-Index (0 = Montag) + Stunde in Europe/Berlin. */
export function berlinNow(now: Date): { date: string; weekdayIndex: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekdayIndex: order.indexOf(parts.weekday),
    hour: parseInt(parts.hour, 10),
  };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Erstes echtes Gericht (keine Notiz) eines Wochentags. */
export function firstDish(days: DayPlan[], weekday: string): PlannedRecipe | null {
  const day = days.find((d) => d.day === weekday);
  const entry = (day?.recipes ?? []).find((r) => !r.isNote && (r.recipeSlug || r.recipeName));
  return entry ?? null;
}

/**
 * Welche vier Tage werden gezeigt? Normal: heute + 3. Abends, wenn das heutige
 * Gericht schon aus dem rollierenden Plan gelöscht wurde: ab morgen.
 */
export function pickDays(days: DayPlan[], now: Date): { date: string; weekday: string; entry: PlannedRecipe | null }[] {
  const { date, weekdayIndex, hour } = berlinNow(now);
  const todayEmpty = !firstDish(days, WEEKDAYS[weekdayIndex]);
  const start = todayEmpty && hour >= EVENING_HOUR ? 1 : 0;
  return [0, 1, 2, 3].map((i) => {
    const offset = start + i;
    const weekday = WEEKDAYS[(weekdayIndex + offset) % 7];
    return { date: addDays(date, offset), weekday, entry: firstDish(days, weekday) };
  });
}

export function toDish(entry: PlannedRecipe, recipe: Record<string, unknown> | null): Dish {
  const nutrition = (recipe?.nutrition ?? {}) as Record<string, unknown>;
  const image = typeof recipe?.image === "string" && recipe.image ? recipe.image : null;
  const name = (typeof recipe?.name === "string" && recipe.name) || entry.recipeName || entry.recipeSlug || "Unbekannt";
  return {
    name,
    slug: entry.recipeSlug ?? null,
    image: image ? (image.startsWith("http") ? image : SITE + (image.startsWith("/") ? "" : "/") + image) : null,
    totalMinutes: isoMinutes(recipe?.totalTime) ?? (
      (isoMinutes(recipe?.prepTime) ?? 0) + (isoMinutes(recipe?.cookTime) ?? 0) || null
    ),
    kcal: firstNumber(nutrition.calories),
    protein: firstNumber(nutrition.proteinContent),
    diet: typeof recipe?.diet === "string" ? recipe.diet : null,
    cook: entry.cookFamily ?? null,
  };
}

// ---------- Zugriff auf die Kochbuch-Seite (nur lesend) ----------

function readSessionCookie(res: Response): string | null {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
  for (const c of list) {
    const m = c.match(new RegExp(COOKIE_NAME + "=([^;]+)"));
    if (m) return `${COOKIE_NAME}=${m[1]}`;
  }
  return null;
}

async function login(): Promise<void> {
  const password = Deno.env.get("BUNKYO_PASSWORD");
  if (!password) throw new Error("BUNKYO_PASSWORD fehlt");
  const res = await fetch(`${SITE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Login fehlgeschlagen (${res.status})`);
  sessionCookie = readSessionCookie(res);
  if (!sessionCookie) throw new Error("Login ohne Session-Cookie");
}

async function loadPlanDays(retry = true): Promise<DayPlan[]> {
  if (!sessionCookie) await login();
  const res = await fetch(`${SITE}/api/weekly-plan/load?planKey=${PLAN_KEY}`, {
    headers: { cookie: sessionCookie! },
  });
  if (res.status === 401 && retry) {
    sessionCookie = null;
    return loadPlanDays(false);
  }
  if (!res.ok) throw new Error(`Wochenplan nicht ladbar (${res.status})`);
  sessionCookie = readSessionCookie(res) ?? sessionCookie; // gleitende Session mitnehmen
  const json = await res.json();
  return Array.isArray(json?.plan?.days) ? json.plan.days : [];
}

async function loadRecipe(slug: string): Promise<Record<string, unknown> | null> {
  const hit = recipeCache.get(slug);
  if (hit && Date.now() - hit.at < RECIPE_TTL_MS) return hit.data;
  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${SITE}/recipes/${encodeURIComponent(slug)}.json`);
    if (res.ok) data = await res.json();
  } catch { /* Rezept fehlt → nur Name aus dem Plan */ }
  recipeCache.set(slug, { at: Date.now(), data });
  return data;
}

async function buildResponse(): Promise<string> {
  const planDays = await loadPlanDays();
  const picked = pickDays(planDays, new Date());
  const days: DayOut[] = await Promise.all(picked.map(async (p) => ({
    date: p.date,
    weekday: p.weekday,
    dish: p.entry ? toDish(p.entry, p.entry.recipeSlug ? await loadRecipe(p.entry.recipeSlug) : null) : null,
  })));
  return JSON.stringify({ generatedAt: new Date().toISOString(), days });
}

function json(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "GET") return json(JSON.stringify({ error: "Nur GET" }), 405);

    const expected = Deno.env.get("DASHBOARD_KEY");
    const given = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-dashboard-key");
    if (!expected || given !== expected) return json(JSON.stringify({ error: "Nicht erlaubt" }), 401);

    if (responseCache && Date.now() - responseCache.at < RESPONSE_TTL_MS) return json(responseCache.body);
    try {
      const body = await buildResponse();
      responseCache = { at: Date.now(), body };
      return json(body);
    } catch (err) {
      console.error(err);
      return json(JSON.stringify({ error: "Wochenplan gerade nicht erreichbar" }), 502);
    }
  });
}
