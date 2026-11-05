const CACHE_NAME = 'relatos-ocultos-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './indexphone.html',
  './Relatos.html',
  './manifest.webmanifest',
  './images/....jpg',
  './images/ico.ico',
  './images/ico.jpg',
  './images/parchment_bg.jpg',
  './images/brown_paper_texture.jpg',
  './images/background1.jpg',
  './images/backgrounddescarga.jpg',
  './images/parchment_bg_for_papercard.jpg',
  './images/parchment_bg_for_pergamino.jpg',
  './images/parchment_bg_for_relatos.jpg',
  './images/sombreropiri.png',
  './images/arpa.png',
  './images/mate.png',
  './images/ñanduti.png',
  './images/NL1.jpg',
  './images/NL2.jpg',
  './images/NL3.jpg',
  './images/Camino_a_la_Fiesta.jpg',
  './images/El_Infierno_Verde.jpg',
  './images/Ecos_del_Llanto.jpg',
  './images/camino_a_la_fiesta_boceto.jpg',
  './images/infierno_verde.jpg',
  './images/ecos_del_llanto_escena.jpg',
  './images/AxelFoto.jpg',
  './images/CayoFoto.jpg',
  './images/MiguelFoto.jpg',
  './audio/relatos-ocultos.mp3',
  './video/Mateo%20Gamarra.mp4',
  './video/El%20Mens%C3%BA.mp4',
  './video/LA%20LEYENDA%20DEL%20KARAU.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(
      CORE_ASSETS.map(async (asset) => {
        const response = await fetch(asset, { cache: 'reload' });
        if (!response.ok) throw new Error(`No se pudo guardar ${asset}: ${response.status}`);
        await cache.put(asset, response);
      })
    );
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) {
      await caches.delete(CACHE_NAME);
      throw new Error(`Falló la descarga offline de ${failed.length} recurso(s).`);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Los videos usan peticiones Range cuando se reproducen y deben conservar soporte de búsqueda.
  if (request.headers.has('range')) {
    event.respondWith((async () => {
      const cached = await caches.match(request.url);
      if (cached) {
        const range = request.headers.get('range').match(/bytes=(\d+)-(\d*)/);
        if (!range) return cached;
        const bytes = await cached.arrayBuffer();
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
        if (start >= bytes.byteLength || end < start) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
        }
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers: {
            'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`,
            'Accept-Ranges': 'bytes'
          }
        });
      }
      return fetch(request);
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (!self.navigator.onLine && cached) return cached;

      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
      } catch {
        return cached || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
