<script setup lang="ts">
import ConnectionBadge from '~/components/common/ConnectionBadge.vue'
import type { Channel, ConnectionStatus, Role, Workspace } from '~/types/galynx'

const props = withDefaults(defineProps<{
  workspaces: Workspace[]
  activeWorkspaceId: string
  publicChannels: Channel[]
  privateChannels: Channel[]
  activeChannelId?: string
  currentRole: Role
  connectionStatus: ConnectionStatus
}>(), {
  workspaces: () => [],
  activeWorkspaceId: '',
  publicChannels: () => [],
  privateChannels: () => [],
  currentRole: 'member',
  connectionStatus: 'offline'
})

defineEmits<{
  (e: 'switch-workspace', workspaceId: string): void
  (e: 'select-channel', channelId: string): void
  (e: 'create-channel'): void
}>()

const canManageChannels = computed(() => props.currentRole === 'owner' || props.currentRole === 'admin')
const activeWorkspace = computed(
  () => props.workspaces.find((workspace) => workspace.id === props.activeWorkspaceId) ?? props.workspaces[0]
)
</script>

<template>
  <aside class="w-[312px] shrink-0 border-r gx-border gx-panel">
    <div class="h-14 px-4 border-b gx-border flex items-center justify-between gap-3">
      <button type="button" class="flex items-center gap-3 min-w-0 px-2 py-1.5 rounded-lg hover:bg-white/5 transition gx-focus">
        <div class="size-8 rounded-lg bg-cyan-500/20 text-cyan-200 font-semibold text-xs flex items-center justify-center">
          {{ activeWorkspace?.shortLabel ?? 'GX' }}
        </div>
        <div class="min-w-0 text-left">
          <div class="gx-text-section-title text-slate-100 truncate">{{ activeWorkspace?.name ?? 'Galynx' }}</div>
          <div class="gx-text-caption gx-muted">Workspace</div>
        </div>
      </button>

      <ConnectionBadge :status="connectionStatus" />
    </div>

    <div class="p-3">
      <input class="w-full h-10 rounded-lg px-3 gx-text-body gx-input" placeholder="Search channels..." />
    </div>

    <div class="px-3 pb-4 space-y-5 overflow-y-auto max-h-[calc(100vh-128px)]">
      <section>
        <div class="mb-2 flex items-center justify-between">
          <span class="gx-text-caption uppercase tracking-wide gx-muted">Public channels</span>
          <button
            v-if="canManageChannels"
            type="button"
            class="text-xs px-2 py-1 rounded-md gx-btn-primary gx-focus"
            @click="$emit('create-channel')"
          >
            + Create
          </button>
        </div>

        <nav class="space-y-1">
          <button
            v-for="c in publicChannels"
            :key="c.id"
            type="button"
            class="w-full flex items-center justify-between text-left px-2.5 py-2 rounded-md transition gx-focus"
            :class="c.id === activeChannelId ? 'bg-cyan-400/12 text-cyan-100' : 'hover:bg-white/5 text-slate-200'"
            @click="$emit('select-channel', c.id)"
          >
            <span class="gx-text-body truncate"># {{ c.name }}</span>
            <span class="gx-text-caption gx-muted">{{ c.memberCount }}</span>
          </button>
        </nav>
      </section>

      <section>
        <div class="mb-2">
          <span class="gx-text-caption uppercase tracking-wide gx-muted">Private channels</span>
        </div>

        <nav class="space-y-1">
          <button
            v-for="c in privateChannels"
            :key="c.id"
            type="button"
            class="w-full flex items-center justify-between text-left px-2.5 py-2 rounded-md transition gx-focus"
            :class="c.id === activeChannelId ? 'bg-cyan-400/12 text-cyan-100' : 'hover:bg-white/5 text-slate-200'"
            @click="$emit('select-channel', c.id)"
          >
            <span class="gx-text-body truncate">🔒 {{ c.name }}</span>
            <span class="gx-text-caption gx-muted">{{ c.memberCount }}</span>
          </button>
        </nav>
      </section>
    </div>
  </aside>
</template>
