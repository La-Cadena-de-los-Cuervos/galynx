<script setup lang="ts">
defineProps<{
  channelName: string
  isPrivate: boolean
  memberCount: number
  threadOpen?: boolean
}>()

defineEmits<{
  (e: 'toggle-thread'): void
}>()
</script>

<template>
  <header class="h-14 px-6 border-b gx-border gx-panel flex items-center justify-between gap-3">
    <div class="min-w-0 flex items-center gap-2">
      <span class="text-slate-400">{{ isPrivate ? '🔒' : '#' }}</span>
      <h1 class="gx-text-section-title text-slate-100 truncate">{{ channelName }}</h1>
      <span class="gx-badge gx-text-caption gx-muted">{{ memberCount }} members</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-xs px-3 py-1.5 rounded-lg gx-btn-ghost transition gx-focus"
        @click="$emit('toggle-thread')"
      >
        {{ threadOpen ? 'Hide thread' : 'Open thread' }}
      </button>
    </div>
  </header>
</template>
