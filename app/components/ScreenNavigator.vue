<script setup lang="ts">
import { isMockScenario, mockScenarios, type MockScenario } from '~/types/mock'
import type { ConnectionStatus, Role } from '~/types/galynx'

type QuickLink = { label: string; to: string }

const isDev = import.meta.dev
const open = ref(false)
const route = useRoute()
const router = useRouter()

const scenarioLabels: Record<MockScenario, string> = {
  main: 'Main',
  'empty-channel': 'Empty channel',
  'no-channels': 'No channels',
  'thread-open': 'Thread open',
  'file-upload': 'File upload',
  'permission-denied': 'Permission denied',
  reconnecting: 'Reconnecting',
  'create-channel': 'Create channel',
  admin: 'Admin'
}

const roleOptions: Role[] = ['owner', 'admin', 'member']
const connectionOptions: ConnectionStatus[] = ['online', 'reconnecting', 'offline']

const quickLinks: QuickLink[] = [
  { label: 'Login', to: '/login' },
  { label: 'Main shell', to: '/' },
  { label: 'Features', to: '/features' }
]

const currentScenario = computed<MockScenario>(() => {
  const raw = Array.isArray(route.query.scenario) ? route.query.scenario[0] : route.query.scenario
  if (isMockScenario(raw)) return raw
  return 'main'
})

const currentRole = computed<Role>(() => {
  const raw = Array.isArray(route.query.role) ? route.query.role[0] : route.query.role
  if (raw === 'owner' || raw === 'admin' || raw === 'member') return raw
  return 'admin'
})

const currentConnection = computed<ConnectionStatus>(() => {
  const raw = Array.isArray(route.query.connection) ? route.query.connection[0] : route.query.connection
  if (raw === 'online' || raw === 'reconnecting' || raw === 'offline') return raw
  return 'online'
})

const threadOpen = computed<boolean>(() => {
  const raw = Array.isArray(route.query.thread) ? route.query.thread[0] : route.query.thread
  return raw === '1'
})

const patchQuery = async (patch: Record<string, string | undefined>): Promise<void> => {
  const nextQuery: Record<string, string> = {}

  for (const [key, value] of Object.entries(route.query)) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === 'string') {
      nextQuery[key] = first
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    if (!value) {
      delete nextQuery[key]
      continue
    }

    nextQuery[key] = value
  }

  await router.replace({ path: '/', query: nextQuery })
}

const setScenario = async (scenario: MockScenario): Promise<void> => {
  await patchQuery({ scenario })
}

const setRole = async (role: Role): Promise<void> => {
  await patchQuery({ role })
}

const setConnection = async (status: ConnectionStatus): Promise<void> => {
  await patchQuery({ connection: status })
}

const toggleThread = async (): Promise<void> => {
  await patchQuery({ thread: threadOpen.value ? undefined : '1' })
}

const resetAll = async (): Promise<void> => {
  await router.replace({ path: '/' })
}
</script>

<template>
  <div v-if="isDev" class="fixed bottom-4 right-4 z-40 w-[360px] select-none">
    <div class="flex justify-end">
      <button type="button" class="h-9 px-3 rounded-lg gx-btn-ghost gx-text-label gx-focus" @click="open = !open">
        {{ open ? 'Close Dev' : 'Dev' }}
      </button>
    </div>

    <div v-if="open" class="mt-2 rounded-xl border gx-border bg-slate-950/85 backdrop-blur shadow-lg overflow-hidden">
      <div class="px-3 py-2 border-b gx-border flex items-center justify-between">
        <div class="gx-text-label text-slate-100">Mock controls</div>
        <button class="gx-text-label text-slate-400 hover:text-slate-100" type="button" @click="open = false">✕</button>
      </div>

      <div class="p-3 space-y-3 max-h-[72vh] overflow-y-auto">
        <div class="space-y-2">
          <div class="gx-text-caption uppercase tracking-wide gx-muted">Quick links</div>
          <div class="grid grid-cols-3 gap-2">
            <NuxtLink
              v-for="link in quickLinks"
              :key="link.to"
              :to="link.to"
              class="px-2.5 py-2 rounded-md gx-btn-ghost gx-text-label text-center"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>

        <div class="space-y-2">
          <div class="gx-text-caption uppercase tracking-wide gx-muted">Scenario</div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="scenario in mockScenarios"
              :key="scenario"
              type="button"
              class="px-2.5 py-2 rounded-md gx-text-label text-left transition gx-focus"
              :class="currentScenario === scenario ? 'gx-btn-primary' : 'gx-btn-ghost'"
              @click="setScenario(scenario)"
            >
              {{ scenarioLabels[scenario] }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="gx-text-caption uppercase tracking-wide gx-muted">Role</div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="role in roleOptions"
              :key="role"
              type="button"
              class="px-2 py-1.5 rounded-md gx-text-label capitalize transition gx-focus"
              :class="currentRole === role ? 'gx-btn-primary' : 'gx-btn-ghost'"
              @click="setRole(role)"
            >
              {{ role }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="gx-text-caption uppercase tracking-wide gx-muted">Connection</div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="status in connectionOptions"
              :key="status"
              type="button"
              class="px-2 py-1.5 rounded-md gx-text-label capitalize transition gx-focus"
              :class="currentConnection === status ? 'gx-btn-primary' : 'gx-btn-ghost'"
              @click="setConnection(status)"
            >
              {{ status }}
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 px-3 py-2 rounded-md gx-text-label transition gx-focus"
            :class="threadOpen ? 'gx-btn-primary' : 'gx-btn-ghost'"
            @click="toggleThread"
          >
            Thread {{ threadOpen ? 'On' : 'Off' }}
          </button>

          <button type="button" class="px-3 py-2 rounded-md gx-btn-ghost gx-text-label gx-focus" @click="resetAll">
            Reset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
