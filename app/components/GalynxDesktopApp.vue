<script setup lang="ts">
import ApiSettingsModal from '~/components/ApiSettingsModal.vue'
import ChannelHeader from '~/components/ChannelHeader.vue'
import ConfirmActionModal from '~/components/ConfirmActionModal.vue'
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
const showApiSettingsModal = ref(false)
const confirmingAction = ref<null | { kind: 'message' | 'channel'; id: string }>(null)
const confirmBusy = ref(false)
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
  confirmingAction.value = { kind: 'message', id: messageId }
}

const onDeleteChannel = async (channelId: string) => {
  confirmingAction.value = { kind: 'channel', id: channelId }
}

const onDeleteDenied = () => {
  app.notifyError('You do not have permission to delete this message.')
}

const onOpenSettings = async () => {
  try {
    if (!state.value.apiBase) {
      await app.loadApiBaseSetting()
    }
  } catch {
    // Error is already reported in global banner.
  }
  showApiSettingsModal.value = true
}

const onSaveApiBase = async (value: string) => {
  try {
    await app.saveApiBaseSetting(value)
    showApiSettingsModal.value = false
  } catch {
    // Error is already reported in global banner.
  }
}

const confirmTitle = computed(() => {
  if (!confirmingAction.value) return ''
  if (confirmingAction.value.kind === 'channel') return 'Delete channel'
  return 'Delete message'
})

const confirmMessage = computed(() => {
  const action = confirmingAction.value
  if (!action) return ''
  if (action.kind === 'channel') {
    const channel = state.value.channels.find((item) => item.id === action.id)
    return `Are you sure you want to delete #${channel?.name ?? 'channel'}? This action cannot be undone.`
  }
  return 'Are you sure you want to delete this message? This action cannot be undone.'
})

const closeConfirmModal = () => {
  if (confirmBusy.value) return
  confirmingAction.value = null
}

const runConfirmedDelete = async () => {
  const action = confirmingAction.value
  if (!action) return
  confirmBusy.value = true

  try {
    if (action.kind === 'channel') {
      await app.deleteChannel(action.id)
    } else {
      await app.deleteMessage(action.id)
    }
    confirmingAction.value = null
  } catch {
    if (action.kind === 'channel') app.notifyError('Could not delete channel.')
    else app.notifyError('Could not delete message.')
  } finally {
    confirmBusy.value = false
  }
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
  if (state.value.initialized) return
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
      @delete-channel="onDeleteChannel"
      @open-settings="onOpenSettings"
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
        <div v-if="state.errorMessage" class="mb-4 rounded-lg border gx-border bg-rose-500/10 px-3 py-2 text-xs text-rose-100 flex items-center justify-between gap-3">
          <span>{{ state.errorMessage }}</span>
          <button type="button" class="gx-btn-ghost rounded px-2 py-1 text-[11px]" @click="app.clearError()">Dismiss</button>
        </div>

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
              @request-delete-denied="onDeleteDenied"
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
      @request-delete-denied="onDeleteDenied"
      @close="app.closeThread"
    />

    <CreateChannelModal
      v-if="showCreateChannelModal"
      @close="showCreateChannelModal = false"
      @create="onCreateChannel"
    />

    <ConfirmActionModal
      v-if="confirmingAction"
      :title="confirmTitle"
      :message="confirmMessage"
      confirmLabel="Delete"
      :busy="confirmBusy"
      @cancel="closeConfirmModal"
      @confirm="runConfirmedDelete"
    />

    <ApiSettingsModal
      v-if="showApiSettingsModal"
      :modelValue="state.apiBase"
      :busy="state.settingsSaving"
      @close="showApiSettingsModal = false"
      @save="onSaveApiBase"
    />
  </div>
</template>
