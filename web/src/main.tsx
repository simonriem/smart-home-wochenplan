import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./theme" // vor App: liest ?theme=, bevor App die Adresse aufräumt
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker: macht die Seite als App installierbar (Chrome: "App installieren")
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}))
}
