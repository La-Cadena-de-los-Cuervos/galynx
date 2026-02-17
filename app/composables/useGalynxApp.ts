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
  settingsLoading: boolean
  settingsSaving: boolean
  errorMessage?: string
  apiBase: string
  currentUser?: User
  users: User[]
  channels: ApiChannelDto[]
  activeChannelId?: string
  messagesByChannel: Record<string, Message[]>
  messageNextCursorByChannel: Record<string, string | null>
  loadingMoreMessagesByChannel: Record<string, boolean>
  threadRoot?: Message
  threadReplies: Message[]
  threadRepliesNextCursor: string | null
  loadingMoreThreadReplies: boolean
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
  settingsLoading: false,
  settingsSaving: false,
  apiBase: '',
  users: [],
  channels: [],
  messagesByChannel: {},
  messageNextCursorByChannel: {},
  loadingMoreMessagesByChannel: {},
  threadReplies: [],
  threadRepliesNextCursor: null,
  loadingMoreThreadReplies: false,
  connectionStatus: 'offline'
})

export const useGalynxApp = () => {
  const api = useGalynxApi()
  const state = useState<GalynxAppState>('galynx-app', makeInitialState)
  let errorTimer: ReturnType<typeof setTimeout> | null = null

  const setError = (message: string) => {
    state.value.errorMessage = message
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => {
      state.value.errorMessage = undefined
      errorTimer = null
    }, 5000)
  }

  const clearError = () => {
    state.value.errorMessage = undefined
    if (errorTimer) {
      clearTimeout(errorTimer)
      errorTimer = null
    }
  }

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

  const mergeByIdSorted = (items: Message[]): Message[] => {
    const map = new Map<string, Message>()
    for (const item of items) map.set(item.id, item)
    return Array.from(map.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  const loadMessages = async (channelId: string, opts?: { append?: boolean; cursor?: string }) => {
    const list = await api.messagesList(channelId, 50, opts?.cursor)
    const mapped = list.items.map(mapApiMessageToUi)
    for (const message of mapped) ensureUser(message.userId)
    if (opts?.append) {
      state.value.messagesByChannel[channelId] = mergeByIdSorted([
        ...(state.value.messagesByChannel[channelId] ?? []),
        ...mapped
      ])
    } else {
      state.value.messagesByChannel[channelId] = mapped
    }
    state.value.messageNextCursorByChannel[channelId] = list.next_cursor
  }

  const bootstrap = async () => {
    if (state.value.bootstrapping) return
    state.value.bootstrapping = true
    state.value.errorMessage = undefined

    try {
      if (!state.value.apiBase) {
        await loadApiBaseSetting()
      }
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
      setError(mapApiError(error))
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
      setError(mapApiError(error))
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
    try {
      const created = await api.channelsCreate(name, isPrivate)
      state.value.channels = [created, ...state.value.channels]
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
  }

  const loadApiBaseSetting = async () => {
    if (state.value.settingsLoading) return
    state.value.settingsLoading = true
    try {
      const apiBase = await api.settingsGetApiBase()
      state.value.apiBase = apiBase
    } catch (error) {
      setError(mapApiError(error))
      throw error
    } finally {
      state.value.settingsLoading = false
    }
  }

  const saveApiBaseSetting = async (apiBase: string) => {
    state.value.settingsSaving = true
    try {
      const next = await api.settingsSetApiBase(apiBase)
      state.value.apiBase = next
      await api.realtimeDisconnect().catch(() => {})
      if (state.value.initialized) {
        await api.realtimeConnect().catch(() => {})
      }
    } catch (error) {
      setError(mapApiError(error))
      throw error
    } finally {
      state.value.settingsSaving = false
    }
  }

  const deleteChannel = async (channelId: string) => {
    try {
      await api.channelsDelete(channelId)
      state.value.channels = state.value.channels.filter((channel) => channel.id !== channelId)
      delete state.value.messagesByChannel[channelId]
      delete state.value.messageNextCursorByChannel[channelId]
      delete state.value.loadingMoreMessagesByChannel[channelId]

      if (state.value.activeChannelId === channelId) {
        const next = state.value.channels[0]
        state.value.activeChannelId = next?.id
        if (next && !state.value.messagesByChannel[next.id]) {
          await loadMessages(next.id)
        }
      }
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
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
      setError('Could not send message.')
    }
  }

  const isMessageOwner = (messageId: string): boolean => {
    const userId = state.value.currentUser?.id
    if (!userId) return false
    for (const messages of Object.values(state.value.messagesByChannel)) {
      const match = messages.find((message) => message.id === messageId)
      if (!match) continue
      return match.userId === userId
    }
    return false
  }

  const editMessage = async (messageId: string, nextBody: string) => {
    try {
      const updated = await api.messagesEdit(messageId, nextBody)
      upsertMessage(mapApiMessageToUi(updated))
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      await api.messagesDelete(messageId)
      removeMessage(messageId)
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
  }

  const openThread = async (root: Message) => {
    state.value.threadRoot = root
    const replies = await api.threadRepliesList(root.id, 50)
    state.value.threadReplies = replies.items.map(mapApiMessageToUi)
    state.value.threadRepliesNextCursor = replies.next_cursor
    for (const reply of state.value.threadReplies) ensureUser(reply.userId)
  }

  const closeThread = () => {
    state.value.threadRoot = undefined
    state.value.threadReplies = []
    state.value.threadRepliesNextCursor = null
  }

  const sendThreadReply = async (text: string) => {
    if (!state.value.threadRoot) return
    try {
      const sent = await api.threadReplySend(state.value.threadRoot.id, text)
      const mapped = mapApiMessageToUi(sent)
      state.value.threadReplies.push(mapped)
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
  }

  const loadMoreMessages = async () => {
    const channelId = state.value.activeChannelId
    if (!channelId) return
    const cursor = state.value.messageNextCursorByChannel[channelId]
    if (!cursor) return
    if (state.value.loadingMoreMessagesByChannel[channelId]) return

    state.value.loadingMoreMessagesByChannel[channelId] = true
    try {
      await loadMessages(channelId, { append: true, cursor })
    } catch (error) {
      setError(mapApiError(error))
    } finally {
      state.value.loadingMoreMessagesByChannel[channelId] = false
    }
  }

  const loadMoreThreadReplies = async () => {
    const root = state.value.threadRoot
    const cursor = state.value.threadRepliesNextCursor
    if (!root || !cursor || state.value.loadingMoreThreadReplies) return

    state.value.loadingMoreThreadReplies = true
    try {
      const list = await api.threadRepliesList(root.id, 50, cursor)
      const mapped = list.items.map(mapApiMessageToUi)
      for (const message of mapped) ensureUser(message.userId)
      state.value.threadReplies = mergeByIdSorted([...state.value.threadReplies, ...mapped])
      state.value.threadRepliesNextCursor = list.next_cursor
    } catch (error) {
      setError(mapApiError(error))
    } finally {
      state.value.loadingMoreThreadReplies = false
    }
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

  const hasMoreMessages = computed<boolean>(() => {
    const channelId = state.value.activeChannelId
    if (!channelId) return false
    return Boolean(state.value.messageNextCursorByChannel[channelId])
  })

  const isLoadingMoreMessages = computed<boolean>(() => {
    const channelId = state.value.activeChannelId
    if (!channelId) return false
    return Boolean(state.value.loadingMoreMessagesByChannel[channelId])
  })

  const hasMoreThreadReplies = computed<boolean>(() => Boolean(state.value.threadRepliesNextCursor))

  return {
    state,
    activeMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    hasMoreThreadReplies,
    bootstrap,
    login,
    logout,
    selectChannel,
    createChannel,
    deleteChannel,
    loadApiBaseSetting,
    saveApiBaseSetting,
    sendMessage,
    editMessage,
    deleteMessage,
    isMessageOwner,
    loadMoreMessages,
    openThread,
    closeThread,
    sendThreadReply,
    loadMoreThreadReplies,
    applyRealtimeEvent,
    setConnectionStatus,
    notifyError: setError,
    clearError
  }
}
