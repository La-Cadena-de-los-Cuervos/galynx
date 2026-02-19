<script setup lang="ts">
import MessageItem from '~/components/MessageItem.vue'
import MessageComposer from '~/components/MessageComposer.vue'
import type { Message, User } from '~/types/galynx'

const props = defineProps<{
  rootMessage: Message
  replies: Message[]
  users: User[]
  currentUser: User
  canLoadMore?: boolean
  loadingMore?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send-reply', payload: { message: string; files?: File[] }): void
  (e: 'load-more'): void
  (e: 'edit', payload: { messageId: string; body: string }): void
  (e: 'delete', messageId: string): void
  (e: 'request-delete-denied'): void
}>()

const replyCountLabel = computed(() => `${props.replies.length} ${props.replies.length === 1 ? 'reply' : 'replies'}`)
const repliesScroller = ref<HTMLElement | null>(null)
const pendingScrollAnchor = ref<{ height: number; top: number } | null>(null)
const scrollDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const requestLoadMore = () => {
  if (!props.canLoadMore || props.loadingMore) return
  const scroller = repliesScroller.value
  if (!scroller) return
  pendingScrollAnchor.value = {
    height: scroller.scrollHeight,
    top: scroller.scrollTop
  }
  emit('load-more')
}

const onRepliesScroll = () => {
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
  }

  scrollDebounceTimer.value = setTimeout(() => {
    const scroller = repliesScroller.value
    if (!scroller) return
    if (scroller.scrollTop > 120) return
    requestLoadMore()
  }, 150)
}

watch(
  () => props.replies.length,
  async (nextLen, prevLen) => {
    if (nextLen <= prevLen) return
    if (!pendingScrollAnchor.value) return
    await nextTick()
    const scroller = repliesScroller.value
    if (!scroller) return
    const delta = scroller.scrollHeight - pendingScrollAnchor.value.height
    scroller.scrollTop = pendingScrollAnchor.value.top + delta
    pendingScrollAnchor.value = null
  }
)

onBeforeUnmount(() => {
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
    scrollDebounceTimer.value = null
  }
})
</script>

<template>
  <aside class="w-[396px] min-w-[396px] shrink-0 border-l gx-border gx-panel flex flex-col">
    <div class="h-14 px-4 border-b gx-border flex items-center justify-between">
      <div>
        <div class="gx-text-section-title text-slate-100">Thread</div>
        <div class="gx-text-caption gx-muted">{{ replyCountLabel }}</div>
      </div>

      <button class="text-xs px-2 py-1 rounded-md gx-btn-ghost gx-focus" type="button" @click="$emit('close')">
        Close
      </button>
    </div>

    <div ref="repliesScroller" class="flex-1 overflow-y-auto px-3 py-3 space-y-3" @scroll.passive="onRepliesScroll">
      <div class="rounded-lg border gx-border bg-slate-950/45">
        <MessageItem
          :message="rootMessage"
          :users="users"
          :currentUser="currentUser"
          :showReplyAction="false"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
          @request-delete-denied="$emit('request-delete-denied')"
        />
      </div>

      <div class="space-y-2">
        <div v-if="loadingMore" class="px-2 py-1 gx-text-caption gx-muted">Loading older replies...</div>

        <MessageItem
          v-for="r in replies"
          :key="r.id"
          :message="r"
          :users="users"
          :currentUser="currentUser"
          :showReplyAction="false"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
          @request-delete-denied="$emit('request-delete-denied')"
        />
      </div>
    </div>

    <div class="p-3 border-t gx-border">
      <MessageComposer draftKey="galynx-thread-draft" @send="$emit('send-reply', $event)" />
    </div>
  </aside>
</template>
