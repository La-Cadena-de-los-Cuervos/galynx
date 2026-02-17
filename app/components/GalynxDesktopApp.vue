<script setup lang="ts">
import ChannelHeader from '~/components/ChannelHeader.vue'
import CreateChannelModal from '~/components/CreateChannelModal.vue'
import EmptyState from '~/components/EmptyState.vue'
import LeftSidebar from '~/components/LeftSidebar.vue'
import MessageComposer from '~/components/MessageComposer.vue'
import MessageItem from '~/components/MessageItem.vue'
import ThreadPanel from '~/components/threads/ThreadPanel.vue'
import type { Channel, Message, User, Workspace } from '~/types/galynx'

const app = useGalynxApp()
const router = useRouter()
const state = app.state
const activeMessages = app.activeMessages
const hasMoreMessages = app.hasMoreMessages
const isLoadingMoreMessages = app.isLoadingMoreMessages
const hasMoreThreadReplies = app.hasMoreThreadReplies
const messagesScroller = ref<HTMLElement | null>(null)
const scrollDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const workspaces: Workspace[] = [{ id: 'ws-1', name: 'Galynx Engineering', shortLabel: 'GX' }]
const showCreateChannelModal = ref(false)
const fallbackUser = computed<User>(() => {
  const current = state.value.currentUser
  if (current) return current
  return {
    id: 'system',
    name: 'System',
    email: 'system@galynx.local',
    role: 'member',
    status: 'active',
    avatarColor: '#64748b'
  }
})

const activeChannel = computed<Channel | null>(() => {
  const raw = state.value.channels.find((item) => item.id === state.value.activeChannelId)
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    privacy: raw.is_private ? 'private' : 'public',
    memberCount: 0
  }
})

const publicChannels = computed<Channel[]>(() => {
  return state.value.channels
    .filter((item) => !item.is_private)
    .map((item) => ({
      id: item.id,
      name: item.name,
      privacy: 'public',
      memberCount: 0
    }))
})

const privateChannels = computed<Channel[]>(() => {
  return state.value.channels
    .filter((item) => item.is_private)
    .map((item) => ({
      id: item.id,
      name: item.name,
      privacy: 'private',
      memberCount: 0
    }))
})

type DayGroup = {
  label: string
  items: Message[]
}

const dayGroups = computed<DayGroup[]>(() => {
  const groups = new Map<string, Message[]>()
  for (const message of activeMessages.value) {
    const label = message.timestamp.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    const current = groups.get(label)
    if (current) current.push(message)
    else groups.set(label, [message])
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
})

const onSendMessage = async (payload: { message: string; files?: File[] }) => {
  await app.sendMessage(payload.message, payload.files ?? [])
}

const onReply = async (messageId: string) => {
  const root = activeMessages.value.find((item) => item.id === messageId)
  if (!root) return
  await app.openThread(root)
}

const onSendThreadReply = async (message: string) => {
  await app.sendThreadReply(message)
}

const onEditMessage = async (payload: { messageId: string; body: string }) => {
  await app.editMessage(payload.messageId, payload.body)
}

const onDeleteMessage = async (messageId: string) => {
  await app.deleteMessage(messageId)
}

const onLoadMoreMessages = async () => {
  const scroller = messagesScroller.value
  const previousHeight = scroller?.scrollHeight ?? 0
  const previousTop = scroller?.scrollTop ?? 0
  await app.loadMoreMessages()
  await nextTick()
  if (!scroller) return
  const delta = scroller.scrollHeight - previousHeight
  scroller.scrollTop = previousTop + delta
}

const onLoadMoreThreadReplies = async () => {
  await app.loadMoreThreadReplies()
}

const onMessagesScroll = async () => {
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
  }

  scrollDebounceTimer.value = setTimeout(async () => {
    const scroller = messagesScroller.value
    if (!scroller) return
    if (!hasMoreMessages.value || isLoadingMoreMessages.value) return
    if (scroller.scrollTop > 120) return
    await onLoadMoreMessages()
  }, 150)
}

onBeforeUnmount(() => {
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
    scrollDebounceTimer.value = null
  }
})

const onCreateChannel = async (payload: { name: string; isPrivate: boolean }) => {
  await app.createChannel(payload.name, payload.isPrivate)
  showCreateChannelModal.value = false
}

onMounted(async () => {
  try {
    await app.bootstrap()
  } catch {
    await router.push('/login')
  }
})
</script>

<template>
  <div class="flex h-screen overflow-hidden text-slate-100">
    <LeftSidebar
      :workspaces="workspaces"
      activeWorkspaceId="ws-1"
      :publicChannels="publicChannels"
      :privateChannels="privateChannels"
      :activeChannelId="activeChannel?.id"
      :currentRole="state.currentUser?.role ?? 'member'"
      :connectionStatus="state.connectionStatus"
      @select-channel="app.selectChannel"
      @create-channel="showCreateChannelModal = true"
    />

    <main class="flex-1 min-w-0 flex flex-col">
      <ChannelHeader
        v-if="activeChannel"
        :channelName="activeChannel.name"
        :isPrivate="activeChannel.privacy === 'private'"
        :memberCount="activeChannel.memberCount"
        :threadOpen="Boolean(state.threadRoot)"
        @toggle-thread="app.closeThread"
      />

      <section ref="messagesScroller" class="flex-1 min-h-0 overflow-y-auto px-6 py-6" @scroll.passive="onMessagesScroll">
        <div v-if="state.connectionStatus === 'reconnecting'" class="mb-4 text-xs px-3 py-2 rounded-lg border gx-border bg-amber-500/10 text-amber-100">
          Reconnecting to WebSocket... Your drafts are safe.
        </div>

        <EmptyState v-if="!activeChannel && !state.bootstrapping" variant="no-channels" />

        <div v-else-if="activeMessages.length === 0 && !state.bootstrapping" class="mx-auto w-full max-w-[900px]">
          <EmptyState variant="empty-channel" :channelName="activeChannel?.name" :isPrivate="activeChannel?.privacy === 'private'" />
        </div>

        <div v-else class="mx-auto w-full max-w-[900px] space-y-6">
          <div
            v-for="group in dayGroups"
            :key="group.label"
            class="space-y-2"
          >
            <div class="gx-divider-label">{{ group.label }}</div>

            <MessageItem
              v-for="message in group.items"
              :key="message.id"
              :message="message"
              :users="state.users"
              :currentUser="fallbackUser"
              @reply="onReply"
              @edit="onEditMessage"
              @delete="onDeleteMessage"
            />
          </div>
        </div>
      </section>

      <footer v-if="activeChannel" class="shrink-0 border-t gx-border gx-panel p-4">
        <div class="mx-auto w-full max-w-[920px]">
          <MessageComposer @send="onSendMessage" @cancel-upload="() => {}" />
        </div>
      </footer>
    </main>

    <ThreadPanel
      v-if="state.threadRoot"
      :rootMessage="state.threadRoot"
      :replies="state.threadReplies"
      :users="state.users"
      :currentUser="fallbackUser"
      :canLoadMore="hasMoreThreadReplies"
      :loadingMore="state.loadingMoreThreadReplies"
      @send-reply="onSendThreadReply"
      @load-more="onLoadMoreThreadReplies"
      @edit="onEditMessage"
      @delete="onDeleteMessage"
      @close="app.closeThread"
    />

    <CreateChannelModal
      v-if="showCreateChannelModal"
      @close="showCreateChannelModal = false"
      @create="onCreateChannel"
    />
  </div>
</template>
