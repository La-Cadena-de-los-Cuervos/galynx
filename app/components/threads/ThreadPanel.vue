<script setup lang="ts">
import MessageItem from '~/components/MessageItem.vue'
import MessageComposer from '~/components/MessageComposer.vue'
import type { Message, User } from '~/types/galynx'

const props = defineProps<{
  rootMessage: Message
  replies: Message[]
  users: User[]
  currentUser: User
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'send-reply', message: string): void
}>()

const replyCountLabel = computed(() => `${props.replies.length} ${props.replies.length === 1 ? 'reply' : 'replies'}`)
</script>

<template>
  <aside class="w-[396px] shrink-0 border-l gx-border gx-panel flex flex-col">
    <div class="h-14 px-4 border-b gx-border flex items-center justify-between">
      <div>
        <div class="gx-text-section-title text-slate-100">Thread</div>
        <div class="gx-text-caption gx-muted">{{ replyCountLabel }}</div>
      </div>

      <button class="text-xs px-2 py-1 rounded-md gx-btn-ghost gx-focus" type="button" @click="$emit('close')">
        Close
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      <div class="rounded-lg border gx-border bg-slate-950/45">
        <MessageItem :message="rootMessage" :users="users" :currentUser="currentUser" />
      </div>

      <div class="space-y-2">
        <MessageItem
          v-for="r in replies"
          :key="r.id"
          :message="r"
          :users="users"
          :currentUser="currentUser"
        />
      </div>
    </div>

    <div class="p-3 border-t gx-border">
      <MessageComposer draftKey="galynx-thread-draft" @send="$emit('send-reply', $event.message)" />
    </div>
  </aside>
</template>
