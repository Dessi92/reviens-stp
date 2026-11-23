// Reviens STP : garde la page sur la tablette pour qu'elle s'ouvre même sans internet (23/11/2026).
// Toujours la dernière version quand internet marche (réseau d'abord), la copie gardée sinon.
// Les échanges avec la base (Supabase) ne passent jamais par ici : ils sont gérés par la file d'attente de la page.
const CACHE = "reviens-stp-1";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const FICHIERS = ["./", "./index.html", "./config.js", "./manifest.json", "./icone.svg", "./icone-192.png", "./icone-512.png", SUPABASE_JS];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FICHIERS.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord, avec une limite de temps (partage de connexion faible), puis la copie gardée
function reseauPuisCopie(req, delai){
  return caches.open(CACHE).then(cache => new Promise(ok => {
    let fini = false;
    const copie = () => cache.match(req, {ignoreSearch: true})
      .then(r => r || (req.mode === "navigate" ? cache.match("./index.html") : undefined));
    const minuteur = setTimeout(() => copie().then(r => { if (r && !fini){ fini = true; ok(r); } }), delai);
    fetch(req).then(r => {
      if (r && r.ok) cache.put(req, r.clone()).catch(() => {});
      clearTimeout(minuteur);
      if (!fini){ fini = true; ok(r); }
    }).catch(() => {
      clearTimeout(minuteur);
      copie().then(r => { if (!fini){ fini = true; ok(r || Response.error()); } });
    });
  }));
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.href === SUPABASE_JS){   // bibliothèque à version fixe : la copie gardée suffit
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { if (n.ok || n.type === "opaque"){ const d = n.clone(); caches.open(CACHE).then(c => c.put(req, d)); } return n; })));
    return;
  }
  if (url.origin !== self.location.origin) return;   // base, Stripe, etc. : jamais en cache
  e.respondWith(reseauPuisCopie(req, req.mode === "navigate" ? 6000 : 8000));
});
