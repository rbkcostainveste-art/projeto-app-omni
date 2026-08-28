const CACHE="flight-ia-v2";
const OFFLINE="/offline.html";

self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll([OFFLINE,"/favicon.ico"])).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(request.mode==="navigate") {
    event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE)));
    return;
  }
  if(url.pathname.startsWith("/_next/static/")||url.pathname.endsWith(".ico")||url.pathname.endsWith(".png")) {
    event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{ const copy=response.clone(); void caches.open(CACHE).then((cache)=>cache.put(request,copy)); return response; })));
  }
});

self.addEventListener("push",(event)=>{
  const data=event.data?event.data.json():{};
  event.waitUntil(self.registration.showNotification(data.title??"Flight IA",{
    body:data.body??"Há uma atualização operacional.",icon:"/favicon.ico",badge:"/favicon.ico",
    tag:data.flightId?`flight-${data.flightId}`:"flight-alert",renotify:true,data:{url:data.url??"/"},
  }));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then((windows)=>{ const existing=windows.find((windowClient)=>"focus" in windowClient); return existing?existing.focus():clients.openWindow(event.notification.data?.url??"/"); }));
});
