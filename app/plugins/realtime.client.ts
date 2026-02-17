import { listen } from '@tauri-apps/api/event'
import type { ConnectionStatus, RealtimeEnvelope } from '~/types/galynx'

export default defineNuxtPlugin(async () => {
  if (!('__TAURI_INTERNALS__' in window)) return

  const app = useGalynxApp()

  await listen<{ status?: ConnectionStatus }>('realtime:status', (event) => {
    const status = event.payload?.status
    if (status === 'online' || status === 'reconnecting' || status === 'offline') {
      app.setConnectionStatus(status)
    }
  })

  await listen<RealtimeEnvelope>('realtime:event', (event) => {
    app.applyRealtimeEvent(event.payload ?? {})
  })
})
