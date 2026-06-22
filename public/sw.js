
// Handle service worker installation
self.addEventListener('install', function (event) {
  // Skip waiting to activate immediately
  self.skipWaiting()
})

// Handle service worker activation
self.addEventListener('activate', function (event) {
  // Claim all clients immediately
  event.waitUntil(self.clients.claim())
})

// Handle push notifications
self.addEventListener('push', function (event) {
  
  if (event.data) {
    try {
      const data = event.data.json()
      
      const options = {
        body: data.body,
        icon: data.icon || '/logo.png',
        badge: '/logo.png',
        vibrate: [100, 50, 100],
        requireInteraction: false,
        silent: false,
        tag: data.data?.tag || 'default',
        data: data.data || {
          dateOfArrival: Date.now(),
          primaryKey: '2',
        },
        actions: data.data?.route ? [
          {
            action: 'open',
            title: 'Open',
            icon: '/logo.png'
          }
        ] : undefined
      }
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
          .then(() => {
          })
          .catch((error) => {
            console.error('Service Worker: Error showing notification:', error)
          })
      )
    } catch (error) {
      console.error('Service Worker: Error processing push data:', error)
      // Fallback notification
      event.waitUntil(
        self.registration.showNotification('New Notification', {
          body: 'You have a new notification',
          icon: '/logo.png',
          badge: '/logo.png'
        })
      )
    }
  } else {
    // Show a default notification if no data
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification',
        icon: '/logo.png',
        badge: '/logo.png'
      })
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', function (event) {
  
  event.notification.close()
  
  if (event.action === 'open' || !event.action) {
    const data = event.notification.data
    const urlToOpen = data?.route || '/'
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window/tab open with the target URL
          for (const client of clientList) {
            if (client.url.includes(urlToOpen) && 'focus' in client) {
              return client.focus()
            }
          }
          
          // If no window/tab is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen)
          }
        })
        .catch((error) => {
          console.error('Service Worker: Error handling notification click:', error)
          // Fallback: try to open window anyway
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen)
          }
        })
    )
  }
})

// Handle notification close
self.addEventListener('notificationclose', function (event) {
})

// Handle background sync (for offline support)
self.addEventListener('sync', function (event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Add any background sync logic here
}

// Handle message events from the main thread
self.addEventListener('message', function (event) {
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
}) 