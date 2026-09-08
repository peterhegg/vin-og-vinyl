import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/vin-og-vinyl/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      manifest: {
        name: "Vin og vinyl",
        short_name: "Vin og vinyl",
        description: "Vinsamling og vinylsamling på ett sted",
        theme_color: "#6B2737",
        background_color: "#1A0A0E",
        display: "standalone",
        orientation: "portrait",
        start_url: "/vin-og-vinyl/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
