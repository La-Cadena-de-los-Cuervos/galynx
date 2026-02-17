<script setup lang="ts">
import type { Attachment, Message, Role, User } from '~/types/galynx'

const props = defineProps<{
  message: Message
  users: User[]
  currentUser: User
}>()

defineEmits<{
  (e: 'reply', messageId: string): void
  (e: 'request-delete-denied'): void
}>()

const sender = computed(() => props.users.find((user) => user.id === props.message.userId))

const initials = computed(() => {
  const n = sender.value?.name?.trim() ?? 'U'
  const parts = n.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U'
})

const timeLabel = computed(() => {
  const d = props.message.timestamp
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const canDelete = computed(() => {
  const role: Role = props.currentUser.role
  return props.currentUser.id === props.message.userId || role === 'owner' || role === 'admin'
})

const renderMarkdown = (value: string): string => {
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

  const withLinks = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a class="gx-accent hover:underline" href="$1" target="_blank" rel="noreferrer">$1</a>')
  const withBold = withLinks.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*(.+?)\*/g, '<em>$1</em>')
  const withCode = withItalic.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan-200 text-[12px]">$1</code>')
  return withCode.replace(/\n/g, '<br>')
}

const renderedContent = computed(() => renderMarkdown(props.message.content))

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let n = bytes
  let u = 0

  while (n >= 1024 && u < units.length - 1) {
    n /= 1024
    u += 1
  }

  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
}

const attachmentErrorLabel = (attachment: Attachment): string => {
  if (attachment.error === 'file-too-large') return 'File too large (max 100 MB)'
  if (attachment.error === 'permission-denied') return 'Permission denied'
  if (attachment.error === 'upload-failed') return 'Upload failed'
  return 'Attachment error'
}
</script>

<template>
  <article class="px-4 py-3.5 rounded-lg hover:bg-slate-900/40 group transition">
    <div class="flex gap-3">
      <div
        class="size-9 rounded-full flex items-center justify-center text-sm font-semibold text-black shrink-0"
        :style="{ background: sender?.avatarColor ?? '#94a3b8' }"
      >
        {{ initials }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 min-w-0">
          <span class="gx-text-body font-semibold text-slate-100 truncate">{{ sender?.name ?? 'Unknown' }}</span>
          <span class="gx-text-label gx-muted">{{ timeLabel }}</span>
          <span v-if="message.edited" class="gx-text-caption gx-muted">(edited)</span>
          <span v-if="message.status === 'sending'" class="gx-text-caption text-amber-200">Sending...</span>
          <span v-if="message.status === 'failed'" class="gx-text-caption text-rose-200">Failed to send</span>
        </div>

        <div v-if="message.deleted" class="mt-1 gx-text-body text-slate-500 italic">Message deleted</div>
        <div v-else class="mt-1.5 gx-text-body text-slate-200 leading-6 break-words" v-html="renderedContent" />

        <div v-if="message.attachments?.length" class="mt-3 space-y-2">
          <div
            v-for="a in message.attachments"
            :key="a.id"
            class="galynx-surface rounded-lg p-3 flex items-center justify-between gap-3"
          >
            <div class="min-w-0 flex-1">
              <div class="gx-text-body text-slate-100 truncate">{{ a.name }}</div>
              <div class="gx-text-label gx-muted">{{ formatBytes(a.size) }}</div>

              <div v-if="a.status === 'uploading'" class="mt-2 h-1.5 bg-slate-900/70 rounded overflow-hidden">
                <div class="h-full bg-cyan-400/85" :style="{ width: `${a.uploadProgress ?? 0}%` }" />
              </div>

              <div v-if="a.status === 'failed'" class="mt-1 gx-text-caption text-rose-300">
                {{ attachmentErrorLabel(a) }}
              </div>
            </div>

            <button
              type="button"
              class="px-3 py-1.5 rounded text-xs gx-btn-ghost gx-focus"
            >
              Download
            </button>
          </div>
        </div>

        <div class="mt-2 flex items-center gap-3">
          <button
            type="button"
            class="gx-text-label text-slate-400 hover:text-cyan-200 opacity-0 group-hover:opacity-100 transition gx-focus rounded px-1"
            @click="$emit('reply', message.id)"
          >
            Reply in thread
          </button>

          <button
            type="button"
            class="gx-text-label opacity-0 group-hover:opacity-100 transition gx-focus rounded px-1"
            :class="canDelete ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-rose-300'"
            @click="!canDelete && $emit('request-delete-denied')"
          >
            Delete
          </button>

          <span v-if="typeof message.replyCount === 'number'" class="gx-text-label gx-muted">
            {{ message.replyCount }} replies
          </span>
        </div>
      </div>
    </div>
  </article>
</template>
