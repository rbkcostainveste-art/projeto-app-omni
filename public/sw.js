const CACHE="flight-ia-v3";
const OFFLINE="/offline.html";
const APP="/app";

function appNotificationUrl(data={}) {
  let url;
  try { url=new URL(data.url||APP,self.location.origin); }
  catch { url=new URL(APP,self.location.origin); }
  if(url.origin!==self.location.origin) url=new URL(APP,self.location.origin);
  if(url.pathname!==APP&&!url.pathname.startsWith(`${APP}/`)) url.pathname=APP;
  if(data.noteId) url.searchParams.set("note",data.noteId);
  if(data.conversationId) url.searchParams.set("chat",data.conversationId);
  return url.href;
}

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
    tag:data.tag??(data.flightId?`flight-${data.flightId}`:"flight-alert"),renotify:true,data:{url:appNotificationUrl(data),conversationId:data.conversationId,noteId:data.noteId},
  }));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const data=event.notification.data||{};
  const target=appNotificationUrl(data);
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(async(windows)=>{
    const appWindow=windows.find((windowClient)=>{
      const url=new URL(windowClient.url);
      return url.origin===self.location.origin&&(url.pathname===APP||url.pathname.startsWith(`${APP}/`));
    });
    if(appWindow){
      const params=new URL(target).searchParams;
      if(params.get("note"))appWindow.postMessage({type:"open-note",id:params.get("note")});
      if(params.get("chat"))appWindow.postMessage({type:"open-chat",id:params.get("chat")});
      return appWindow.focus();
    }
    const existing=windows.find((windowClient)=>new URL(windowClient.url).origin===self.location.origin&&"navigate" in windowClient);
    if(existing){const opened=await existing.navigate(target);if(opened)return opened.focus();}
    return clients.openWindow(target);
  }));
});
