import { deepStrictEqual as assertEquals } from "node:assert";
import { addDays, berlinNow, firstNumber, isoMinutes, pickDays, toDish } from "./index.ts";

const plan = [
  { day: "Montag", recipes: [{ recipeSlug: "milchreis", cookFamily: "Kuhn" }] },
  { day: "Dienstag", recipes: [] },
  { day: "Mittwoch", recipes: [{ recipeName: "Oma kommt", isNote: true }, { recipeSlug: "chili-con-carne", cookFamily: "Riem" }] },
  { day: "Donnerstag", recipes: [{ recipeSlug: "kaesespaetzle" }] },
  { day: "Freitag", recipes: [] },
  { day: "Samstag", recipes: [] },
  { day: "Sonntag", recipes: [{ recipeSlug: "pizza" }] },
];

Deno.test("isoMinutes", () => {
  assertEquals(isoMinutes("PT1H30M"), 90);
  assertEquals(isoMinutes("PT45M"), 45);
  assertEquals(isoMinutes("PT0M"), null);
  assertEquals(isoMinutes("abc"), null);
});

Deno.test("firstNumber", () => {
  assertEquals(firstNumber("540 kcal"), 540);
  assertEquals(firstNumber("32,6 g"), 33);
  assertEquals(firstNumber(undefined), null);
});

Deno.test("berlinNow + addDays (Winterzeit, Mitternacht UTC)", () => {
  const b = berlinNow(new Date("2026-11-18T23:30:00Z")); // 00:30 Do in Berlin
  assertEquals(b, { date: "2026-11-19", weekdayIndex: 3, hour: 0 });
  assertEquals(addDays("2026-12-30", 3), "2027-01-02");
});

Deno.test("pickDays: tagsüber heute + 3, Notiz übersprungen", () => {
  const days = pickDays(plan, new Date("2026-11-18T10:00:00Z")); // Mi 11 Uhr
  assertEquals(days.map((d) => d.weekday), ["Mittwoch", "Donnerstag", "Freitag", "Samstag"]);
  assertEquals(days[0].entry?.recipeSlug, "chili-con-carne");
  assertEquals(days[0].date, "2026-11-18");
});

Deno.test("pickDays: abends und heute gelöscht → ab morgen", () => {
  const days = pickDays(plan, new Date("2026-11-17T20:00:00Z")); // Di 21 Uhr, Dienstag leer
  assertEquals(days.map((d) => d.weekday), ["Mittwoch", "Donnerstag", "Freitag", "Samstag"]);
  assertEquals(days[0].date, "2026-11-18");
});

Deno.test("pickDays: abends, heute noch da → bleibt heute", () => {
  const days = pickDays(plan, new Date("2026-11-18T19:00:00Z")); // Mi 20 Uhr
  assertEquals(days[0].weekday, "Mittwoch");
});

Deno.test("pickDays: Wochenumbruch So → Mo", () => {
  const days = pickDays(plan, new Date("2026-11-22T10:00:00Z")); // Sonntag
  assertEquals(days.map((d) => d.weekday), ["Sonntag", "Montag", "Dienstag", "Mittwoch"]);
});

Deno.test("toDish mit und ohne Rezeptdatei", () => {
  const d = toDish({ recipeSlug: "milchreis", cookFamily: "Kuhn" }, {
    name: "Milchreis", image: "/recipes/images/milchreis.jpg", totalTime: "PT1H",
    nutrition: { calories: "203 kcal", proteinContent: "6 g" }, diet: "vegetarisch",
  });
  assertEquals(d, {
    name: "Milchreis", slug: "milchreis", image: "https://bunkyo-kochbuch.vercel.app/recipes/images/milchreis.jpg",
    totalMinutes: 60, kcal: 203, protein: 6, diet: "vegetarisch", cook: "Kuhn",
  });
  assertEquals(toDish({ recipeName: "Grillen" }, null).name, "Grillen");
  assertEquals(toDish({ recipeName: "Grillen" }, null).image, null);
});
