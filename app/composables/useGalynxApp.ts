import type {
  Attachment,
  ApiAttachmentDto,
  ApiChannelDto,
  ApiError,
  ApiMessageDto,
  ConnectionStatus,
  Message,
  RealtimeEnvelope,
  Role,
  User
} from '~/types/galynx'

type GalynxAppState = {
  initialized: boolean
  bootstrapping: boolean
  authenticating: boolean
  errorMessage?: string
  currentUser?: User
  users: User[]
  channels: ApiChannelDto[]
  activeChannelId?: string
  messagesByChannel: Record<string, Message[]>
  threadRoot?: Message
  threadReplies: Message[]
  connectionStatus: ConnectionStatus
}

const AVATAR_COLORS = ['#22c55e', '#06b6d4', '#a855f7', '#f97316', '#14b8a6', '#eab308']

const avatarColorFromId = (id: string): string => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? '#64748b'
}

const toDate = (raw: number): Date => {
  if (raw < 1_000_000_000_000) return new Date(raw * 1000)
  return new Date(raw)
}

const mapApiMessageToUi = (message: ApiMessageDto): Message => ({
  id: message.id,
  channelId: message.channel_id,
  userId: message.sender_id,
  content: message.body_md,
  timestamp: toDate(message.created_at),
  status: 'sent',
  edited: typeof message.edited_at === 'number',
  deleted: typeof message.deleted_at === 'number'
})

const mapApiAttachmentToUi = (attachment: ApiAttachmentDto): Attachment => ({
  id: attachment.id,
  name: attachment.name,
  size: attachment.size_bytes,
  status: 'uploaded',
  contentType: attachment.content_type ?? undefined,
  storageKey: attachment.storage_key ?? undefined,
  downloadUrl: attachment.download_url ?? undefined
})

const mapApiError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return 'Unexpected error'
  const apiError = error as Partial<ApiError>
  return apiError.message ?? 'Unexpected error'
}

const makeInitialState = (): GalynxAppState => ({
  initialized: false,
  bootstrapping: false,
  authenticating: false,
  users: [],
  channels: [],
  messagesByChannel: {},
  threadReplies: [],
  connectionStatus: 'offline'
})

export const useGalynxApp = () => {
  const api = useGalynxApi()
  const state = useState<GalynxAppState>('galynx-app', makeInitialState)

  const ensureUser = (id: string, role: Role = 'member') => {
    const existing = state.value.users.find((user) => user.id === id)
    if (existing) return existing

    const user: User = {
      id,
      name: `User ${id.slice(0, 6)}`,
      email: `${id.slice(0, 8)}@galynx.local`,
      role,
      status: 'active',
      avatarColor: avatarColorFromId(id)
    }
    state.value.users.push(user)
    return user
  }

  const applyCurrentUser = (raw: { id: string; name: string; email: string; role: Role }) => {
    const user: User = {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      role: raw.role,
      status: 'active',
      avatarColor: avatarColorFromId(raw.id)
    }
    state.value.currentUser = user
    const found = state.value.users.findIndex((item) => item.id === user.id)
    if (found >= 0) state.value.users[found] = user
    else state.value.users.unshift(user)
  }

  const upsertMessage = (message: Message) => {
    const channelMessages = state.value.messagesByChannel[message.channelId] ?? []
    const idx = channelMessages.findIndex((item) => item.id === message.id)
    if (idx >= 0) {
      channelMessages[idx] = message
    } else {
      channelMessages.push(message)
      channelMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }
    state.value.messagesByChannel[message.channelId] = channelMessages
    ensureUser(message.userId)
  }

  const updateMessageById = (channelId: string, messageId: string, updater: (current: Message) => Message) => {
    const channelMessages = state.value.messagesByChannel[channelId] ?? []
    const idx = channelMessages.findIndex((item) => item.id === messageId)
    if (idx < 0) return
    channelMessages[idx] = updater(channelMessages[idx] as Message)
    state.value.messagesByChannel[channelId] = [...channelMessages]
  }

  const removeMessage = (messageId: string) => {
    for (const [channelId, messages] of Object.entries(state.value.messagesByChannel)) {
      const next = messages.filter((item) => item.id !== messageId)
      state.value.messagesByChannel[channelId] = next
    }
  }

  const loadMessages = async (channelId: string) => {
    const list = await api.messagesList(channelId, 50)
    const mapped = list.items.map(mapApiMessageToUi)
    for (const message of mapped) ensureUser(message.userId)
    state.value.messagesByChannel[channelId] = mapped
  }

  const bootstrap = async () => {
    if (state.value.bootstrapping) return
    state.value.bootstrapping = true
    state.value.errorMessage = undefined

    try {
      const me = await api.authMe()
      applyCurrentUser(me)

      const channels = await api.channelsList()
      state.value.channels = channels
      const firstChannel = channels[0]
      if (firstChannel) {
        state.value.activeChannelId = state.value.activeChannelId ?? firstChannel.id
        await loadMessages(state.value.activeChannelId)
      }

      await api.realtimeConnect()
      state.value.connectionStatus = 'online'
      state.value.initialized = true
    } catch (error) {
      state.value.errorMessage = mapApiError(error)
      throw error
    } finally {
      state.value.bootstrapping = false
    }
  }

  const login = async (email: string, password: string) => {
    state.value.authenticating = true
    state.value.errorMessage = undefined
    try {
      const session = await api.authLogin(email, password)
      applyCurrentUser(session.user)
      state.value.initialized = false
    } catch (error) {
      state.value.errorMessage = mapApiError(error)
      throw error
    } finally {
      state.value.authenticating = false
    }
  }

  const logout = async () => {
    await api.realtimeDisconnect().catch(() => {})
    await api.authLogout().catch(() => {})
    state.value = makeInitialState()
  }

  const selectChannel = async (channelId: string) => {
    state.value.activeChannelId = channelId
    if (!state.value.messagesByChannel[channelId]) {
      await loadMessages(channelId)
    }
  }

  const createChannel = async (name: string, isPrivate: boolean) => {
    const created = await api.channelsCreate(name, isPrivate)
    state.value.channels = [created, ...state.value.channels]
  }

  const sendMessage = async (text: string, files: File[] = []) => {
    const channelId = state.value.activeChannelId
    const user = state.value.currentUser
    if (!channelId || !user) return

    const optimistic: Message = {
      id: `tmp-${crypto.randomUUID()}`,
      channelId,
      userId: user.id,
      content: text,
      timestamp: new Date(),
      status: 'sending',
      attachments: files.map((file) => ({
        id: `tmp-att-${crypto.randomUUID()}`,
        name: file.name,
        size: file.size,
        status: 'uploading',
        uploadProgress: 0,
        contentType: file.type
      }))
    }
    upsertMessage(optimistic)

    try {
      const sent = await api.messagesSend(channelId, text)
      const mapped = mapApiMessageToUi(sent)
      const channelMessages = state.value.messagesByChannel[channelId] ?? []
      state.value.messagesByChannel[channelId] = channelMessages.filter((item) => item.id !== optimistic.id)
      upsertMessage(mapped)

      if (files.length > 0) {
        const committedAttachments: Attachment[] = []
        for (const file of files) {
          try {
            const bytes = new Uint8Array(await file.arrayBuffer())
            const committed = await api.attachmentsUploadCommit(
              channelId,
              mapped.id,
              file.name,
              file.type || 'application/octet-stream',
              bytes
            )
            committedAttachments.push(mapApiAttachmentToUi(committed))
          } catch {
            committedAttachments.push({
              id: `failed-att-${crypto.randomUUID()}`,
              name: file.name,
              size: file.size,
              status: 'failed',
              error: 'upload-failed',
              contentType: file.type
            })
          }
        }

        updateMessageById(channelId, mapped.id, (current) => ({
          ...current,
          attachments: committedAttachments
        }))
      }
    } catch {
      optimistic.status = 'failed'
      upsertMessage(optimistic)
    }
  }

  const openThread = async (root: Message) => {
    state.value.threadRoot = root
    const replies = await api.threadRepliesList(root.id, 50)
    state.value.threadReplies = replies.items.map(mapApiMessageToUi)
    for (const reply of state.value.threadReplies) ensureUser(reply.userId)
  }

  const closeThread = () => {
    state.value.threadRoot = undefined
    state.value.threadReplies = []
  }

  const sendThreadReply = async (text: string) => {
    if (!state.value.threadRoot) return
    const sent = await api.threadReplySend(state.value.threadRoot.id, text)
    const mapped = mapApiMessageToUi(sent)
    state.value.threadReplies.push(mapped)
  }

  const applyRealtimeEvent = (event: RealtimeEnvelope) => {
    const type = event.event_type
    const payload = event.payload as Record<string, unknown> | undefined
    if (!type) return

    if (type === 'MESSAGE_CREATED' || type === 'MESSAGE_UPDATED') {
      const message = (payload?.message as ApiMessageDto | undefined) ?? (payload as ApiMessageDto | undefined)
      if (!message) return
      upsertMessage(mapApiMessageToUi(message))
      return
    }

    if (type === 'MESSAGE_DELETED') {
      const messageId = (payload?.message_id ?? payload?.id) as string | undefined
      if (!messageId) return
      removeMessage(messageId)
      return
    }

    if (type === 'CHANNEL_CREATED') {
      const channel = payload?.channel as ApiChannelDto | undefined
      if (!channel) return
      const exists = state.value.channels.some((item) => item.id === channel.id)
      if (!exists) state.value.channels = [channel, ...state.value.channels]
      return
    }

    if (type === 'CHANNEL_DELETED') {
      const channelId = (payload?.channel_id ?? payload?.id) as string | undefined
      if (!channelId) return
      state.value.channels = state.value.channels.filter((item) => item.id !== channelId)
      delete state.value.messagesByChannel[channelId]
    }
  }

  const setConnectionStatus = (next: ConnectionStatus) => {
    state.value.connectionStatus = next
  }

  const activeMessages = computed<Message[]>(() => {
    const channelId = state.value.activeChannelId
    if (!channelId) return []
    return state.value.messagesByChannel[channelId] ?? []
  })

  return {
    state,
    activeMessages,
    bootstrap,
    login,
    logout,
    selectChannel,
    createChannel,
    sendMessage,
    openThread,
    closeThread,
    sendThreadReply,
    applyRealtimeEvent,
    setConnectionStatus
  }
}
