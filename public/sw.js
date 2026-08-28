self.addEventListener("push",(event)=>{
  const data=event.data?event.data.json():{};
  event.waitUntil(self.registration.showNotification(data.title??"Flight IA",{
    body:data.body??"Há uma atualização operacional.",
    icon:"/favicon.ico",
    badge:"/favicon.ico",
    tag:data.flightId?`flight-${data.flightId}`:"flight-alert",
    renotify:true,
    data:{url:data.url??"/"},
  }));
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then((windows)=>{
    const existing=windows.find((windowClient)=>"focus" in windowClient);
    return existing?existing.focus():clients.openWindow(event.notification.data?.url??"/");
  }));
});
