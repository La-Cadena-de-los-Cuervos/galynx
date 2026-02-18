import type {
  Attachment,
  ApiAttachmentDto,
  ApiAuditDto,
  ApiChannelMemberDto,
  ApiChannelDto,
  ApiError,
  ApiMessageDto,
  ApiUserDto,
  ApiWorkspaceMemberDto,
  ApiWorkspaceDto,
  AuditEntry,
  ChannelMember,
  ConnectionStatus,
  Message,
  RealtimeEnvelope,
  Role,
  Workspace,
  WorkspaceMember,
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
  workspaces: Workspace[]
  activeWorkspaceId?: string
  currentUser?: User
  users: User[]
  channels: ApiChannelDto[]
  workspaceMembersByWorkspace: Record<string, WorkspaceMember[]>
  channelMembersByChannel: Record<string, ChannelMember[]>
  adminUsers: User[]
  adminUsersLoading: boolean
  auditItems: AuditEntry[]
  auditNextCursor: string | null
  auditLoading: boolean
  auditLoadingMore: boolean
  reconcilingRealtime: boolean
  recentRealtimeKeys: string[]
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
const ACTIVE_WORKSPACE_STORAGE_KEY = 'galynx.activeWorkspaceId'
const ATTACHMENT_URL_TTL_MS = 9 * 60 * 1000
const MAX_RECENT_REALTIME_KEYS = 500

const avatarColorFromId = (id: string): string => {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? '#64748b'
}

const toDate = (raw: number): Date => {
  if (raw < 1_000_000_000_000) return new Date(raw * 1000)
  return new Date(raw)
}

const shortLabel = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'WS'
  if (words.length === 1) return words[0]?.slice(0, 2).toUpperCase() ?? 'WS'
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase()
}

const mapWorkspace = (raw: ApiWorkspaceDto): Workspace | null => {
  const id = typeof raw.id === 'string'
    ? raw.id
    : (typeof raw.workspace_id === 'string' ? raw.workspace_id : null)
  const name = typeof raw.name === 'string' ? raw.name : null
  if (!id || !name) return null
  return { id, name, shortLabel: shortLabel(name) }
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
  downloadUrl: attachment.download_url ?? undefined,
  downloadUrlFetchedAt: attachment.download_url ? Date.now() : undefined
})

const mapApiUserToUi = (user: ApiUserDto): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: 'active',
  avatarColor: avatarColorFromId(user.id)
})

const mapApiAuditToUi = (raw: ApiAuditDto): AuditEntry | null => {
  if (
    !raw.id
    || !raw.workspace_id
    || !raw.actor_id
    || !raw.action
    || !raw.target_type
    || !raw.target_id
    || typeof raw.created_at !== 'number'
  ) {
    return null
  }
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    actorId: raw.actor_id,
    action: raw.action,
    targetType: raw.target_type,
    targetId: raw.target_id,
    metadata: raw.metadata ?? {},
    createdAt: toDate(raw.created_at)
  }
}

const mapApiError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return 'Unexpected error'
  const apiError = error as Partial<ApiError>
  return apiError.message ?? 'Unexpected error'
}

const normalizeRole = (raw: unknown): Role => {
  if (raw === 'owner' || raw === 'admin' || raw === 'member') return raw
  return 'member'
}

const mapWorkspaceMember = (raw: ApiWorkspaceMemberDto, workspaceId: string): WorkspaceMember | null => {
  const userId = typeof raw.user_id === 'string'
    ? raw.user_id
    : (typeof raw.id === 'string' ? raw.id : null)
  if (!userId) return null
  return {
    userId,
    workspaceId,
    role: normalizeRole(raw.role),
    email: typeof raw.email === 'string' ? raw.email : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined
  }
}

const mapChannelMember = (raw: ApiChannelMemberDto, channelId: string): ChannelMember | null => {
  const userId = typeof raw.user_id === 'string' ? raw.user_id : null
  if (!userId) return null
  return { channelId, userId }
}

const getPersistedActiveWorkspaceId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  const value = window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
  return value ?? undefined
}

const persistActiveWorkspaceId = (workspaceId?: string) => {
  if (typeof window === 'undefined') return
  if (!workspaceId) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId)
}

const makeInitialState = (): GalynxAppState => ({
  initialized: false,
  bootstrapping: false,
  authenticating: false,
  settingsLoading: false,
  settingsSaving: false,
  apiBase: '',
  workspaces: [],
  users: [],
  channels: [],
  workspaceMembersByWorkspace: {},
  channelMembersByChannel: {},
  adminUsers: [],
  adminUsersLoading: false,
  auditItems: [],
  auditNextCursor: null,
  auditLoading: false,
  auditLoadingMore: false,
  reconcilingRealtime: false,
  recentRealtimeKeys: [],
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

  const updateAttachmentInMessage = (
    message: Message,
    attachmentId: string,
    updater: (current: Attachment) => Attachment
  ): Message => {
    const attachments = message.attachments ?? []
    const idx = attachments.findIndex((item) => item.id === attachmentId)
    if (idx < 0) return message
    const next = [...attachments]
    next[idx] = updater(next[idx] as Attachment)
    return { ...message, attachments: next }
  }

  const updateAttachmentAcrossState = (attachmentId: string, updater: (current: Attachment) => Attachment): Attachment | null => {
    for (const [channelId, messages] of Object.entries(state.value.messagesByChannel)) {
      const index = messages.findIndex((message) => (message.attachments ?? []).some((item) => item.id === attachmentId))
      if (index < 0) continue
      const currentMessage = messages[index] as Message
      const updatedMessage = updateAttachmentInMessage(currentMessage, attachmentId, updater)
      const nextMessages = [...messages]
      nextMessages[index] = updatedMessage
      state.value.messagesByChannel[channelId] = nextMessages
      return updatedMessage.attachments?.find((item) => item.id === attachmentId) ?? null
    }

    if (state.value.threadRoot && (state.value.threadRoot.attachments ?? []).some((item) => item.id === attachmentId)) {
      state.value.threadRoot = updateAttachmentInMessage(state.value.threadRoot, attachmentId, updater)
      return state.value.threadRoot.attachments?.find((item) => item.id === attachmentId) ?? null
    }

    const replyIndex = state.value.threadReplies.findIndex((message) => (message.attachments ?? []).some((item) => item.id === attachmentId))
    if (replyIndex >= 0) {
      const next = [...state.value.threadReplies]
      next[replyIndex] = updateAttachmentInMessage(next[replyIndex] as Message, attachmentId, updater)
      state.value.threadReplies = next
      return next[replyIndex]?.attachments?.find((item) => item.id === attachmentId) ?? null
    }

    return null
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

  const loadChannelsForWorkspace = async (workspaceId?: string) => {
    const channels = await api.channelsList()
    const filtered = workspaceId
      ? channels.filter((channel) => channel.workspace_id === workspaceId)
      : channels
    state.value.channels = filtered

    const currentActive = state.value.activeChannelId
    const stillExists = Boolean(currentActive && filtered.some((channel) => channel.id === currentActive))
    const nextActive = stillExists ? currentActive : filtered[0]?.id
    state.value.activeChannelId = nextActive
    state.value.threadRoot = undefined
    state.value.threadReplies = []
    state.value.threadRepliesNextCursor = null

    if (nextActive) {
      await loadMessages(nextActive)
    }

    // Preload private-channel memberships for access control and member counts.
    const privateChannelIds = filtered.filter((channel) => channel.is_private).map((channel) => channel.id)
    await Promise.all(privateChannelIds.map((channelId) => loadChannelMembers(channelId).catch(() => {})))
  }

  const hydrateUsersFromWorkspaceMembers = (workspaceId: string) => {
    const members = state.value.workspaceMembersByWorkspace[workspaceId] ?? []
    for (const member of members) {
      const user = ensureUser(member.userId, member.role)
      if (member.name) user.name = member.name
      if (member.email) user.email = member.email
      user.role = member.role
    }
  }

  const loadWorkspaceMembers = async (workspaceId: string) => {
    const list = await api.workspaceMembersList(workspaceId)
    const members = list
      .map((item) => mapWorkspaceMember(item, workspaceId))
      .filter((item): item is WorkspaceMember => item !== null)
    state.value.workspaceMembersByWorkspace[workspaceId] = members
    hydrateUsersFromWorkspaceMembers(workspaceId)
  }

  const upsertWorkspaceMember = async (
    workspaceId: string,
    payload: { email: string; role: 'admin' | 'member'; name?: string; password?: string }
  ) => {
    await api.workspaceMembersUpsert(workspaceId, payload)
    await loadWorkspaceMembers(workspaceId)
  }

  const loadChannelMembers = async (channelId: string) => {
    const list = await api.channelMembersList(channelId)
    const members = list
      .map((item) => mapChannelMember(item, channelId))
      .filter((item): item is ChannelMember => item !== null)
    state.value.channelMembersByChannel[channelId] = members
  }

  const addChannelMember = async (channelId: string, userId: string) => {
    await api.channelMembersAdd(channelId, userId)
    await loadChannelMembers(channelId)
  }

  const removeChannelMember = async (channelId: string, userId: string) => {
    await api.channelMembersRemove(channelId, userId)
    await loadChannelMembers(channelId)
  }

  const loadUsers = async () => {
    if (state.value.adminUsersLoading) return
    state.value.adminUsersLoading = true
    try {
      const users = await api.usersList()
      const mapped = users.map(mapApiUserToUi)
      state.value.adminUsers = mapped
      const current = state.value.currentUser
      if (current && !mapped.some((user) => user.id === current.id)) {
        state.value.adminUsers = [current, ...mapped]
      }
    } catch (error) {
      setError(mapApiError(error))
      throw error
    } finally {
      state.value.adminUsersLoading = false
    }
  }

  const createUser = async (payload: { email: string; name: string; password: string; role: 'admin' | 'member' }) => {
    try {
      const created = await api.usersCreate(payload)
      const mapped = mapApiUserToUi(created)
      const idx = state.value.adminUsers.findIndex((user) => user.id === mapped.id)
      if (idx >= 0) {
        state.value.adminUsers[idx] = mapped
      } else {
        state.value.adminUsers = [mapped, ...state.value.adminUsers]
      }
      const usersIdx = state.value.users.findIndex((user) => user.id === mapped.id)
      if (usersIdx >= 0) state.value.users[usersIdx] = mapped
      else state.value.users.push(mapped)
      return mapped
    } catch (error) {
      setError(mapApiError(error))
      throw error
    }
  }

  const loadAudit = async () => {
    if (state.value.auditLoading) return
    state.value.auditLoading = true
    try {
      const list = await api.auditList(50)
      const mapped = list.items.map(mapApiAuditToUi).filter((item): item is AuditEntry => item !== null)
      state.value.auditItems = mapped
      state.value.auditNextCursor = list.next_cursor
    } catch (error) {
      setError(mapApiError(error))
      throw error
    } finally {
      state.value.auditLoading = false
    }
  }

  const loadMoreAudit = async () => {
    const cursor = state.value.auditNextCursor
    if (!cursor || state.value.auditLoadingMore) return
    state.value.auditLoadingMore = true
    try {
      const list = await api.auditList(50, cursor)
      const mapped = list.items.map(mapApiAuditToUi).filter((item): item is AuditEntry => item !== null)
      const deduped = new Map<string, AuditEntry>()
      for (const item of [...state.value.auditItems, ...mapped]) deduped.set(item.id, item)
      state.value.auditItems = Array.from(deduped.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      state.value.auditNextCursor = list.next_cursor
    } catch (error) {
      setError(mapApiError(error))
      throw error
    } finally {
      state.value.auditLoadingMore = false
    }
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

      const workspaceDtos = await api.workspacesList()
      const workspaces = workspaceDtos.map(mapWorkspace).filter((item): item is Workspace => item !== null)
      state.value.workspaces = workspaces
      const persistedWorkspaceId = getPersistedActiveWorkspaceId()
      const preferredWorkspaceId = state.value.activeWorkspaceId
        ?? persistedWorkspaceId
        ?? me.workspace_id
        ?? workspaces[0]?.id
      state.value.activeWorkspaceId = preferredWorkspaceId
      persistActiveWorkspaceId(preferredWorkspaceId)

      if (preferredWorkspaceId) {
        await loadWorkspaceMembers(preferredWorkspaceId)
      }

      await loadChannelsForWorkspace(preferredWorkspaceId)

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
    if (!state.value.channelMembersByChannel[channelId]) {
      await loadChannelMembers(channelId).catch(() => {})
    }
    if (!state.value.messagesByChannel[channelId]) {
      await loadMessages(channelId)
    }
  }

  const switchWorkspace = async (workspaceId: string) => {
    if (state.value.activeWorkspaceId === workspaceId) return
    state.value.activeWorkspaceId = workspaceId
    persistActiveWorkspaceId(workspaceId)
    await loadWorkspaceMembers(workspaceId)
    await loadChannelsForWorkspace(workspaceId)
  }

  const createChannel = async (name: string, isPrivate: boolean) => {
    try {
      const created = await api.channelsCreate(name, isPrivate)
      const activeWorkspaceId = state.value.activeWorkspaceId
      if (!activeWorkspaceId || created.workspace_id === activeWorkspaceId) {
        state.value.channels = [created, ...state.value.channels]
      }
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
      delete state.value.channelMembersByChannel[channelId]

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

  const ensureAttachmentDownloadUrl = async (attachmentId: string): Promise<string | null> => {
    let found: Attachment | null = null

    for (const messages of Object.values(state.value.messagesByChannel)) {
      for (const message of messages) {
        const attachment = (message.attachments ?? []).find((item) => item.id === attachmentId)
        if (!attachment) continue
        found = attachment
        break
      }
      if (found) break
    }

    if (!found && state.value.threadRoot) {
      found = (state.value.threadRoot.attachments ?? []).find((item) => item.id === attachmentId) ?? null
    }
    if (!found) {
      for (const reply of state.value.threadReplies) {
        const attachment = (reply.attachments ?? []).find((item) => item.id === attachmentId)
        if (!attachment) continue
        found = attachment
        break
      }
    }

    const now = Date.now()
    if (found?.downloadUrl && found.downloadUrlFetchedAt && now - found.downloadUrlFetchedAt < ATTACHMENT_URL_TTL_MS) {
      return found.downloadUrl
    }

    try {
      const refreshed = await api.attachmentGet(attachmentId)
      const mapped = mapApiAttachmentToUi(refreshed)
      const updated = updateAttachmentAcrossState(attachmentId, (current) => ({
        ...current,
        contentType: mapped.contentType ?? current.contentType,
        storageKey: mapped.storageKey ?? current.storageKey,
        downloadUrl: mapped.downloadUrl,
        downloadUrlFetchedAt: mapped.downloadUrl ? Date.now() : undefined
      }))
      return updated?.downloadUrl ?? mapped.downloadUrl ?? null
    } catch (error) {
      setError(mapApiError(error))
      return found?.downloadUrl ?? null
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

  const realtimeEventKey = (event: RealtimeEnvelope): string | null => {
    const eventType = event.event_type
    if (!eventType) return null
    if (event.correlation_id) return `${eventType}:corr:${event.correlation_id}`

    const payload = event.payload as Record<string, unknown> | undefined
    const payloadId = typeof payload?.id === 'string'
      ? payload.id
      : (typeof payload?.message_id === 'string'
        ? payload.message_id
        : (typeof payload?.channel_id === 'string' ? payload.channel_id : null))
    const ts = typeof event.server_ts === 'number' ? event.server_ts : 0
    if (payloadId) return `${eventType}:id:${payloadId}:${ts}`
    return `${eventType}:ts:${ts}`
  }

  const seenRealtimeEvent = (event: RealtimeEnvelope): boolean => {
    const key = realtimeEventKey(event)
    if (!key) return false
    if (state.value.recentRealtimeKeys.includes(key)) return true

    const next = [...state.value.recentRealtimeKeys, key]
    if (next.length > MAX_RECENT_REALTIME_KEYS) {
      next.splice(0, next.length - MAX_RECENT_REALTIME_KEYS)
    }
    state.value.recentRealtimeKeys = next
    return false
  }

  const reconcileAfterReconnect = async () => {
    if (state.value.reconcilingRealtime) return
    state.value.reconcilingRealtime = true
    try {
      const workspaceId = state.value.activeWorkspaceId
      await loadChannelsForWorkspace(workspaceId)

      if (workspaceId) {
        await loadWorkspaceMembers(workspaceId).catch(() => {})
      }

      const activeChannelId = state.value.activeChannelId
      if (activeChannelId) {
        await loadChannelMembers(activeChannelId).catch(() => {})
        await loadMessages(activeChannelId).catch(() => {})
      }

      if (state.value.threadRoot) {
        const replies = await api.threadRepliesList(state.value.threadRoot.id, 50)
        state.value.threadReplies = replies.items.map(mapApiMessageToUi)
        state.value.threadRepliesNextCursor = replies.next_cursor
      }
    } catch {
      // Keep UI responsive; next reconnect or manual actions will retry.
    } finally {
      state.value.reconcilingRealtime = false
    }
  }

  const applyRealtimeEvent = (event: RealtimeEnvelope) => {
    const type = event.event_type
    const payload = event.payload as Record<string, unknown> | undefined
    if (!type) return
    if (seenRealtimeEvent(event)) return

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
      const activeWorkspaceId = state.value.activeWorkspaceId
      if (activeWorkspaceId && channel.workspace_id !== activeWorkspaceId) return
      const exists = state.value.channels.some((item) => item.id === channel.id)
      if (!exists) state.value.channels = [channel, ...state.value.channels]
      return
    }

    if (type === 'CHANNEL_DELETED') {
      const channelId = (payload?.channel_id ?? payload?.id) as string | undefined
      if (!channelId) return
      state.value.channels = state.value.channels.filter((item) => item.id !== channelId)
      delete state.value.messagesByChannel[channelId]
      delete state.value.channelMembersByChannel[channelId]
      return
    }

    if (type === 'THREAD_UPDATED') {
      const rootId = (payload?.root_id ?? payload?.thread_root_id ?? payload?.id) as string | undefined
      if (!rootId) return
      if (state.value.threadRoot?.id !== rootId) return
      void (async () => {
        try {
          const replies = await api.threadRepliesList(rootId, 50)
          state.value.threadReplies = replies.items.map(mapApiMessageToUi)
          state.value.threadRepliesNextCursor = replies.next_cursor
        } catch {
          // non-blocking update
        }
      })()
      return
    }

    if (type === 'REACTION_UPDATED') {
      // reactions are not rendered yet, but we still dedupe+accept event for forward compatibility.
      return
    }
  }

  const activeWorkspaceMembers = computed<WorkspaceMember[]>(() => {
    const workspaceId = state.value.activeWorkspaceId
    if (!workspaceId) return []
    return state.value.workspaceMembersByWorkspace[workspaceId] ?? []
  })

  const activeChannelMembers = computed<ChannelMember[]>(() => {
    const channelId = state.value.activeChannelId
    if (!channelId) return []
    return state.value.channelMembersByChannel[channelId] ?? []
  })

  const hasMoreAudit = computed<boolean>(() => Boolean(state.value.auditNextCursor))

  const setConnectionStatus = (next: ConnectionStatus) => {
    const previous = state.value.connectionStatus
    state.value.connectionStatus = next
    if (next === 'online' && (previous === 'reconnecting' || previous === 'offline')) {
      void reconcileAfterReconnect()
    }
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
    hasMoreAudit,
    activeWorkspaceMembers,
    activeChannelMembers,
    bootstrap,
    login,
    logout,
    selectChannel,
    switchWorkspace,
    loadWorkspaceMembers,
    upsertWorkspaceMember,
    loadChannelMembers,
    addChannelMember,
    removeChannelMember,
    loadUsers,
    createUser,
    loadAudit,
    loadMoreAudit,
    createChannel,
    deleteChannel,
    loadApiBaseSetting,
    saveApiBaseSetting,
    sendMessage,
    ensureAttachmentDownloadUrl,
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
