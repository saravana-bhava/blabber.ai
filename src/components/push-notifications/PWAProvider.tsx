'use client'

import { InstallPrompt } from './InstallPrompt'
import { NotificationPrompt } from './NotificationPrompt'

export function PWAProvider() {
  return (
    <div>
      <InstallPrompt />
      <NotificationPrompt />
    </div>
  )
} 