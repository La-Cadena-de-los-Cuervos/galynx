<script setup lang="ts">
import ChannelHeader from '~/components/ChannelHeader.vue'
import CreateChannelModal from '~/components/CreateChannelModal.vue'
import EmptyState from '~/components/EmptyState.vue'
import LeftSidebar from '~/components/LeftSidebar.vue'
import MessageComposer from '~/components/MessageComposer.vue'
import MessageItem from '~/components/MessageItem.vue'
import UserManagementModal from '~/components/UserManagementModal.vue'
import ThreadPanel from '~/components/threads/ThreadPanel.vue'
import { isMockScenario, type MockScenario } from '~/types/mock'

import type {
  Attachment,
  Channel,
  ConnectionStatus,
  Message,
  Role,
  User,
  Workspace
} from '~/types/galynx'

const props = withDefaults(defineProps<{
  scenario?: MockScenario
}>(), {
  scenario: 'main'
})

const route = useRoute()

const scenario = computed<MockScenario>(() => {
  const fromQuery = route.query.scenario
  const raw = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery
  if (isMockScenario(raw)) return raw
  return props.scenario
})

const queryConnection = computed<ConnectionStatus | null>(() => {
  const rawValue = Array.isArray(route.query.connection) ? route.query.connection[0] : route.query.connection
  if (rawValue === 'online' || rawValue === 'reconnecting' || rawValue === 'offline') return rawValue
  return null
})

const queryRole = computed<Role | null>(() => {
  const rawValue = Array.isArray(route.query.role) ? route.query.role[0] : route.query.role
  if (rawValue === 'owner' || rawValue === 'admin' || rawValue === 'member') return rawValue
  return null
})

const isThreadForcedOpen = computed<boolean>(() => {
  const rawValue = Array.isArray(route.query.thread) ? route.query.thread[0] : route.query.thread
  return rawValue === '1'
})

type DayGroup = {
  label: string
  items: Message[]
}

const workspaces: Workspace[] = [{ id: 'ws-1', name: 'Galynx Engineering', shortLabel: 'GX' }]

const allUsers: User[] = [
  { id: 'u1', name: 'Marco Neri', email: 'marco@galynx.local', role: 'admin', status: 'active', avatarColor: '#22c55e' },
  { id: 'u2', name: 'Ana DevOps', email: 'ana@galynx.local', role: 'owner', status: 'active', avatarColor: '#06b6d4' },
  { id: 'u3', name: 'Luis Backend', email: 'luis@galynx.local', role: 'member', status: 'active', avatarColor: '#a855f7' },
  { id: 'u4', name: 'Sofia QA', email: 'sofia@galynx.local', role: 'member', status: 'active', avatarColor: '#f97316' }
]

const publicChannels: Channel[] = [
  { id: 'general', name: 'general', privacy: 'public', memberCount: 14 },
  { id: 'engineering', name: 'engineering', privacy: 'public', memberCount: 9 },
  { id: 'deployments', name: 'deployments', privacy: 'public', memberCount: 7 }
]

const privateChannels: Channel[] = [
  { id: 'incident-war-room', name: 'incident-war-room', privacy: 'private', memberCount: 4 },
  { id: 'security', name: 'security', privacy: 'private', memberCount: 5 }
]

const connectionStatus = computed<ConnectionStatus>(() => {
  if (queryConnection.value) return queryConnection.value
  if (scenario.value === 'reconnecting') return 'reconnecting'
  return 'online'
})

const currentRole = computed<Role>(() => {
  if (queryRole.value) return queryRole.value
  return scenario.value === 'permission-denied' ? 'member' : 'admin'
})

const currentUser = computed<User>(() => ({
  id: currentRole.value === 'member' ? 'u3' : 'u1',
  name: currentRole.value === 'member' ? 'Luis Backend' : 'Marco Neri',
  email: currentRole.value === 'member' ? 'luis@galynx.local' : 'marco@galynx.local',
  role: currentRole.value,
  status: 'active',
  avatarColor: currentRole.value === 'member' ? '#a855f7' : '#22c55e'
}))

const channelList = computed<Channel[]>(() => {
  if (scenario.value === 'no-channels') return []
  return [...publicChannels, ...privateChannels]
})

const activeChannelId = ref<string>('general')

const activeChannel = computed<Channel | null>(() => {
  const selected = channelList.value.find((channel) => channel.id === activeChannelId.value)
  return selected ?? channelList.value[0] ?? null
})

const baseMessages = ref<Message[]>([
  {
    id: 'm1',
    channelId: 'general',
    userId: 'u2',
    content: '**Deploy completed** for `api-gateway` in production.\nhttps://status.galynx.local',
    timestamp: new Date('2026-02-16T09:10:00'),
    status: 'sent',
    replyCount: 2
  },
  {
    id: 'm2',
    channelId: 'general',
    userId: 'u3',
    content: 'I am checking latency spike in us-east-1.',
    timestamp: new Date('2026-02-16T09:20:00'),
    status: 'sending'
  },
  {
    id: 'm3',
    channelId: 'general',
    userId: 'u4',
    content: 'Adding findings to the runbook now.',
    timestamp: new Date('2026-02-16T10:02:00'),
    status: 'sent',
    edited: true
  },
  {
    id: 'm4',
    channelId: 'general',
    userId: 'u1',
    content: 'Temporary message that failed to sync.',
    timestamp: new Date('2026-02-16T10:11:00'),
    status: 'failed'
  }
])

const threadReplies = ref<Message[]>([
  {
    id: 't1',
    channelId: 'general',
    userId: 'u4',
    content: 'Logs attached. p95 recovered in 5 minutes.',
    timestamp: new Date('2026-02-16T10:20:00'),
    status: 'sent'
  },
  {
    id: 't2',
    channelId: 'general',
    userId: 'u1',
    content: 'Perfect, closing incident once dashboard is green.',
    timestamp: new Date('2026-02-16T10:24:00'),
    status: 'sent'
  }
])

const showThreadPanel = computed<boolean>(() => scenario.value === 'thread-open' || isThreadForcedOpen.value)

const showCreateChannelModal = computed<boolean>(() => scenario.value === 'create-channel')
const showAdminModal = computed<boolean>(() => scenario.value === 'admin')

const uploadQueue = ref<Attachment[]>([])

const permissionDeniedMessage = computed<string | undefined>(() => {
  if (scenario.value !== 'permission-denied') return undefined
  return 'You do not have permission to delete messages from other users.'
})

watch(
  scenario,
  (nextScenario) => {
    if (nextScenario === 'file-upload') {
      uploadQueue.value = [
        {
          id: 'a1',
          name: 'incident-log-2026-02-16.txt',
          size: 12_490,
          status: 'uploading',
          uploadProgress: 72
        },
        {
          id: 'a2',
          name: 'db-dump.tar.gz',
          size: 155 * 1024 * 1024,
          status: 'failed',
          error: 'file-too-large'
        },
        {
          id: 'a3',
          name: 'security-notes.md',
          size: 34_000,
          status: 'failed',
          error: 'permission-denied'
        }
      ]
      return
    }

    uploadQueue.value = []
  },
  { immediate: true }
)

const visibleMessages = computed<Message[]>(() => {
  if (scenario.value === 'empty-channel' || scenario.value === 'no-channels') return []

  if (scenario.value === 'file-upload') {
    return [
      ...baseMessages.value,
      {
        id: 'm5',
        channelId: activeChannelId.value,
        userId: 'u1',
        content: 'Attachment queue in progress, please wait.',
        timestamp: new Date('2026-02-16T10:32:00'),
        status: 'sent',
        attachments: [
          {
            id: 'a4',
            name: 'ops-report.pdf',
            size: 2_100_000,
            status: 'uploading',
            uploadProgress: 48
          }
        ]
      }
    ]
  }

  return baseMessages.value
})

const dayGroups = computed<DayGroup[]>(() => {
  const groups = new Map<string, Message[]>()

  for (const message of visibleMessages.value) {
    const label = message.timestamp.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    const prev = groups.get(label)
    if (prev) {
      prev.push(message)
      continue
    }

    groups.set(label, [message])
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
})

const sendMessage = (payload: { message: string; files?: File[] }) => {
  if (!activeChannel.value) return

  baseMessages.value.push({
    id: crypto.randomUUID(),
    channelId: activeChannel.value.id,
    userId: currentUser.value.id,
    content: payload.message,
    timestamp: new Date(),
    status: 'sent'
  })
}

const sendReply = (payload: { message: string; files?: File[] }) => {
  if (!activeChannel.value) return

  const next = payload.message.trim()
  if (!next) return

  threadReplies.value.push({
    id: crypto.randomUUID(),
    channelId: activeChannel.value.id,
    userId: currentUser.value.id,
    content: next,
    timestamp: new Date(),
    status: 'sent'
  })
}

const cancelUpload = (attachmentId: string) => {
  uploadQueue.value = uploadQueue.value.filter((item) => item.id !== attachmentId)
}

const selectChannel = (channelId: string) => {
  activeChannelId.value = channelId
}

const onDeniedDelete = () => {
  if (scenario.value !== 'permission-denied') return
}
</script>

<template>
  <div class="flex h-screen overflow-hidden text-slate-100">
    <LeftSidebar
      :workspaces="workspaces"
      activeWorkspaceId="ws-1"
      :publicChannels="publicChannels"
      :privateChannels="privateChannels"
      :activeChannelId="activeChannel?.id"
      :currentRole="currentRole"
      :connectionStatus="connectionStatus"
      @select-channel="selectChannel"
    />

    <main class="flex-1 min-w-0 flex flex-col">
      <ChannelHeader
        v-if="activeChannel"
        :channelName="activeChannel.name"
        :isPrivate="activeChannel.privacy === 'private'"
        :memberCount="activeChannel.memberCount"
        :threadOpen="showThreadPanel"
      />

      <section class="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div v-if="scenario === 'reconnecting'" class="mb-4 text-xs px-3 py-2 rounded-lg border gx-border bg-amber-500/10 text-amber-100">
          Reconnecting to WebSocket... Your drafts are safe.
        </div>

        <EmptyState v-if="scenario === 'no-channels'" variant="no-channels" />

        <EmptyState
          v-else-if="scenario === 'empty-channel'"
          variant="empty-channel"
          :channelName="activeChannel?.name"
          :isPrivate="activeChannel?.privacy === 'private'"
        />

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
              :users="allUsers"
              :currentUser="currentUser"
              @reply="() => {}"
              @request-delete-denied="onDeniedDelete"
            />
          </div>
        </div>
      </section>

      <footer v-if="scenario !== 'no-channels'" class="shrink-0 border-t gx-border gx-panel p-4">
        <div class="mx-auto w-full max-w-[920px]">
          <MessageComposer
            :uploadQueue="uploadQueue"
            :permissionDeniedMessage="permissionDeniedMessage"
            @send="sendMessage"
            @pick-files="() => {}"
            @cancel-upload="cancelUpload"
          />
        </div>
      </footer>
    </main>

    <ThreadPanel
      v-if="showThreadPanel && visibleMessages[0]"
      :rootMessage="visibleMessages[0]"
      :replies="threadReplies"
      :users="allUsers"
      :currentUser="currentUser"
      @send-reply="sendReply"
      @close="() => {}"
    />

    <CreateChannelModal v-if="showCreateChannelModal" @close="() => {}" @create="() => {}" />
    <UserManagementModal v-if="showAdminModal" :users="allUsers" :currentUser="currentUser" @close="() => {}" />
  </div>
</template>
