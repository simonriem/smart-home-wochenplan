import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// base "./": läuft unter jeder Adresse (GitHub Pages Unterordner, lokal, …)
export default defineConfig({ base: "./", plugins: [react()] })
