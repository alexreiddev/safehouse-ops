self.addEventListener('notificationclick',e=>{e.notification.close()
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus' in w)return w.focus()}return clients.openWindow('/')}))})
