import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA fallback — serve the app shell for navigations, keep asset/API requests off it
const handler = createHandlerBoundToURL("/vin-og-vinyl/index.html");
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
});
registerRoute(navigationRoute);
