<template>
  <div class="group rounded-lg px-2 py-2 hover:bg-white/3 transition">
    <div class="flex gap-3">
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-black shrink-0"
        :style="{ background: sender?.avatarColor ?? '#9ca3af' }"
      >
        {{ senderInitial }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="text-sm font-semibold text-white truncate">
            {{ sender?.name ?? 'Unknown' }}
          </span>
          <span class="text-xs gx-muted">
            {{ timeLabel }}
          </span>
        </div>

        <div class="text-sm text-white/90 mt-0.5 leading-relaxed break-words">
          {{ message.content }}
        </div>

        <button
          class="mt-1 text-xs text-sky-400/90 hover:text-sky-300 hover:underline opacity-0 group-hover:opacity-100 transition"
          type="button"
          @click="$emit('reply')"
        >
          Reply in thread
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Message, User } from '~/types/galynx'

const props = defineProps<{
  message: Message
  users: User[]
  currentUser: User
}>()

defineEmits<{ (e: 'reply'): void }>()

const sender = computed(() => props.users.find(u => u.id === props.message.userId))

const senderInitial = computed(() => (sender.value?.name?.[0] ?? '?').toUpperCase())

const timeLabel = computed(() => {
  const d = props.message.timestamp instanceof Date ? props.message.timestamp : new Date(props.message.timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>