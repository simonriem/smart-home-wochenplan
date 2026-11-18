# Smart Home – Wochenplan-Dashboard

Zeigt den gemeinsamen Wochenplan der Kochbuch-Seite (bunkyo-kochbuch.vercel.app) schön auf dem Wand-Tablet (Querformat, Vollbild).
**Liest nur.** Am Projekt der Kochbuch-Seite (Supabase, GitHub, Vercel) wird nichts geändert.

## Was angezeigt wird
- Groß: das Gericht von heute (rundes Foto, Name, wer kocht, Gesamtzeit, kcal und Eiweiß, falls vorhanden).
- Unten: die nächsten drei Tage. Tippen oder Wischen holt einen Tag mit der Orbit-Animation nach vorn, nach 30 Sekunden geht es zurück.
- Pro Tag nur das erste Gericht, Notizen werden ignoriert. Ein leerer Tag zeigt „Noch nichts geplant“.
- Abends (ab 18 Uhr), wenn das heutige Gericht im rollierenden Plan schon gelöscht ist, wird „Morgen“ zum großen Gericht.
- Die Farbe des Bogens richtet sich nach der Ernährungsform: Fleisch korall, vegetarisch grün, vegan mint, Fisch blau.

## Aufbau
```
Tablet (GitHub Pages)  --alle 5 Min., ?key=…-->  Edge Function "wochenplan" (Supabase, Projekt "The Perfect Gift")
                                                    |-- POST /api/admin/login         (Kochbuch, Passwort aus Secret)
                                                    |-- GET  /api/weekly-plan/load    (nur lesen)
                                                    '-- GET  /recipes/<slug>.json     (öffentliche Rezeptdateien)
Rezeptbilder lädt das Tablet direkt von bunkyo-kochbuch.vercel.app/recipes/images/…
```
- `supabase/functions/wochenplan/` – Edge Function (Deno) mit Tests (`deno test`).
- `web/` – Tablet-Seite (Vite, React, GSAP) mit Tests (`npm test`). Grundlage ist das „Dish Orbit Carousel“ von 21st.dev, die Schrift ist Outfit (OFL).

## Secrets der Edge Function (Supabase → The Perfect Gift → Edge Functions → Secrets)
| Name | Inhalt |
|---|---|
| `BUNKYO_PASSWORD` | Admin-Passwort der Kochbuch-Seite |
| `DASHBOARD_KEY` | zufälliger Schlüssel; derselbe steht in der Tablet-Adresse |

## Tablet-Adresse
`https://simonriem.github.io/smart-home-wochenplan/?key=<DASHBOARD_KEY>`
Einmal mit `?key=` öffnen. Danach speichert das Tablet den Schlüssel und entfernt ihn aus der Adresszeile.
Dann in Chrome über das Menü „App installieren“ wählen. Die App startet im Vollbild und im Querformat, und das Display bleibt an, solange sie offen ist.
Mit Beispieldaten ohne Schlüssel: `…/?demo=1`

## Verhalten bei Problemen
- Kochbuch-Seite oder Netz weg: Das Tablet zeigt den letzten gespeicherten Stand und „Offline · Stand: …“.
- Abgelaufene Anmeldung: Die Function meldet sich automatisch neu an. Die Sitzung verlängert sich ohnehin bei jedem Abruf.
- Neues Rezept ohne Rezeptdatei: Es wird nur der Name ohne Bild gezeigt.

## Bauen
```
cd web && npm install && npm test && npm run build   # Ergebnis in web/dist
```
