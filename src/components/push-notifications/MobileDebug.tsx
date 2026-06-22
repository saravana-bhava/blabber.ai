'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

export function MobileDebug() {
  const [debugInfo, setDebugInfo] = useState({
    userAgent: '',
    protocol: '',
    serviceWorker: false,
    pushManager: false,
    notifications: false,
    swRegistration: null as ServiceWorkerRegistration | null,
    swState: '',
    subscription: null as PushSubscription | null,
    isStandalone: false,
    isSecureContext: false
  })

  useEffect(() => {
    const gatherDebugInfo = async () => {
      const info = {
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notifications: 'Notification' in window,
        swRegistration: null as ServiceWorkerRegistration | null,
        swState: 'unknown',
        subscription: null as PushSubscription | null,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true,
        isSecureContext: window.isSecureContext
      }

      if (info.serviceWorker) {
        try {
          const reg = await navigator.serviceWorker.getRegistration()
          info.swRegistration = reg || null
          info.swState = reg?.active ? 'active' : reg?.installing ? 'installing' : reg?.waiting ? 'waiting' : 'none'
          
          if (reg) {
            info.subscription = await reg.pushManager.getSubscription()
          }
        } catch (error) {
          console.error('Error getting SW registration:', error)
        }
      }

      setDebugInfo(info)
    }

    gatherDebugInfo()
  }, [])

  return (
    <div className="p-4 border rounded-lg space-y-4 text-sm">
      <h3 className="font-semibold">Debug Information</h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Device/Browser:</span>
          <Badge variant="outline">{debugInfo.userAgent}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">Protocol:</span>
          <Badge variant={debugInfo.protocol === 'https:' ? 'default' : 'destructive'}>
            {debugInfo.protocol}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">Secure Context:</span>
          <Badge variant={debugInfo.isSecureContext ? 'default' : 'destructive'}>
            {debugInfo.isSecureContext ? 'Yes' : 'No'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">Installed as PWA:</span>
          <Badge variant={debugInfo.isStandalone ? 'default' : 'secondary'}>
            {debugInfo.isStandalone ? 'Yes' : 'No'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="font-medium">Features:</span>
          <Badge variant={debugInfo.serviceWorker ? 'default' : 'destructive'}>
            Service Worker: {debugInfo.serviceWorker ? 'Yes' : 'No'}
          </Badge>
          <Badge variant={debugInfo.pushManager ? 'default' : 'destructive'}>
            Push Manager: {debugInfo.pushManager ? 'Yes' : 'No'}
          </Badge>
          <Badge variant={debugInfo.notifications ? 'default' : 'destructive'}>
            Notifications: {debugInfo.notifications ? 'Yes' : 'No'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">Service Worker Status:</span>
          <Badge variant={debugInfo.swState === 'active' ? 'default' : 'secondary'}>
            {debugInfo.swState}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">Push Subscription:</span>
          <Badge variant={debugInfo.subscription ? 'default' : 'secondary'}>
            {debugInfo.subscription ? 'Active' : 'None'}
          </Badge>
        </div>
      </div>
    </div>
  )
} 