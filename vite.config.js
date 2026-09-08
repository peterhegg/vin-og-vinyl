import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * index.html's CSP writes the proxy origin into connect-src as %VITE_PROXY_URL%.
 * Vite leaves the placeholder untouched when the variable is missing, and an
 * unrecognised source expression is simply dropped — so a build without it ships
 * a bundle where connect-src is 'self' and every proxy call is blocked, with no
 * error anywhere but the browser console. Fail the build instead.
 *
 * Only on `build`: `vite preview` also runs in production mode but produces
 * nothing — it just serves whatever dist/ already holds.
 */
function requireProxyUrl(mode, command) {
  const { VITE_PROXY_URL } = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && mode === "production" && !VITE_PROXY_URL) {
    throw new Error(
      "VITE_PROXY_URL is not set. The production CSP needs it in connect-src — " +
        "set it in .env or as a build secret before building."
    );
  }
}

export default defineConfig(({ mode, command }) => {
  requireProxyUrl(mode, command);
  return {
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
  };
});
