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

const emit = defineEmits<{
  (e: 'switch-workspace', workspaceId: string): void
  (e: 'select-channel', channelId: string): void
  (e: 'create-channel'): void
  (e: 'delete-channel', channelId: string): void
  (e: 'open-settings'): void
  (e: 'open-members'): void
}>()

const canManageChannels = computed(() => props.currentRole === 'owner' || props.currentRole === 'admin')
const activeWorkspace = computed(
  () => props.workspaces.find((workspace) => workspace.id === props.activeWorkspaceId) ?? props.workspaces[0]
)
const showWorkspaceMenu = ref(false)

const requestDeleteChannel = (channelId: string) => {
  emit('delete-channel', channelId)
}

const toggleWorkspaceMenu = () => {
  showWorkspaceMenu.value = !showWorkspaceMenu.value
}

const selectWorkspace = (workspaceId: string) => {
  showWorkspaceMenu.value = false
  emit('switch-workspace', workspaceId)
}
</script>

<template>
  <aside class="w-[312px] shrink-0 border-r gx-border gx-panel">
    <div class="relative h-14 px-4 border-b gx-border flex items-center justify-between gap-3">
      <button type="button" class="flex items-center gap-3 min-w-0 px-2 py-1.5 rounded-lg hover:bg-white/5 transition gx-focus" @click="toggleWorkspaceMenu">
        <div class="size-8 rounded-lg bg-cyan-500/20 text-cyan-200 font-semibold text-xs flex items-center justify-center">
          {{ activeWorkspace?.shortLabel ?? 'GX' }}
        </div>
        <div class="min-w-0 text-left">
          <div class="gx-text-section-title text-slate-100 truncate">{{ activeWorkspace?.name ?? 'Galynx' }}</div>
          <div class="gx-text-caption gx-muted">Workspace</div>
        </div>
      </button>

      <div v-if="showWorkspaceMenu" class="absolute left-3 top-14 z-20 w-[280px] rounded-lg border gx-border bg-slate-950/95 p-2 shadow-xl">
        <button
          v-for="workspace in workspaces"
          :key="workspace.id"
          type="button"
          class="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left gx-focus"
          :class="workspace.id === activeWorkspaceId ? 'bg-cyan-400/15 text-cyan-100' : 'hover:bg-white/5 text-slate-200'"
          @click="selectWorkspace(workspace.id)"
        >
          <span class="inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded bg-cyan-500/20 text-cyan-200 text-[10px] font-semibold">
            {{ workspace.shortLabel }}
          </span>
          <span class="gx-text-body truncate">{{ workspace.name }}</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="canManageChannels"
          type="button"
          class="h-8 rounded-md px-2 gx-btn-ghost gx-focus text-[11px]"
          title="Manage members"
          @click="$emit('open-members')"
        >
          Members
        </button>
        <button
          type="button"
          class="h-8 w-8 rounded-md gx-btn-ghost gx-focus text-xs"
          title="API settings"
          @click="$emit('open-settings')"
        >
          ⚙
        </button>
        <ConnectionBadge :status="connectionStatus" />
      </div>
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
          <div
            v-for="c in publicChannels"
            :key="c.id"
            class="w-full flex items-center gap-1 rounded-md transition group"
            :class="c.id === activeChannelId ? 'bg-cyan-400/12 text-cyan-100' : 'hover:bg-white/5 text-slate-200'"
          >
            <button
              type="button"
              class="flex-1 min-w-0 flex items-center justify-between text-left px-2.5 py-2 rounded-md transition gx-focus"
              @click="$emit('select-channel', c.id)"
            >
              <span class="gx-text-body truncate"># {{ c.name }}</span>
              <span class="gx-text-caption gx-muted">{{ c.memberCount }}</span>
            </button>

            <button
              v-if="canManageChannels"
              type="button"
              class="mr-1 h-7 w-7 rounded text-xs gx-btn-ghost gx-focus opacity-0 group-hover:opacity-100 relative z-10"
              title="Delete channel"
              @click.stop="requestDeleteChannel(c.id)"
            >
              ✕
            </button>
          </div>
        </nav>
      </section>

      <section>
        <div class="mb-2">
          <span class="gx-text-caption uppercase tracking-wide gx-muted">Private channels</span>
        </div>

        <nav class="space-y-1">
          <div
            v-for="c in privateChannels"
            :key="c.id"
            class="w-full flex items-center gap-1 rounded-md transition group"
            :class="c.id === activeChannelId ? 'bg-cyan-400/12 text-cyan-100' : 'hover:bg-white/5 text-slate-200'"
          >
            <button
              type="button"
              class="flex-1 min-w-0 flex items-center justify-between text-left px-2.5 py-2 rounded-md transition gx-focus"
              @click="$emit('select-channel', c.id)"
            >
              <span class="gx-text-body truncate">🔒 {{ c.name }}</span>
              <span class="gx-text-caption gx-muted">{{ c.memberCount }}</span>
            </button>

            <button
              v-if="canManageChannels"
              type="button"
              class="mr-1 h-7 w-7 rounded text-xs gx-btn-ghost gx-focus opacity-0 group-hover:opacity-100 relative z-10"
              title="Delete channel"
              @click.stop="requestDeleteChannel(c.id)"
            >
              ✕
            </button>
          </div>
        </nav>
      </section>
    </div>
  </aside>
</template>
