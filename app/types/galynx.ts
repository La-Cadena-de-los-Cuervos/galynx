export type Role = 'owner' | 'admin' | 'member'
export type UserStatus = 'active' | 'disabled'
export type ConnectionStatus = 'online' | 'reconnecting' | 'offline'

export type Workspace = {
  id: string
  name: string
  shortLabel: string
}

export type ChannelPrivacy = 'public' | 'private'

export type Channel = {
  id: string
  name: string
  privacy: ChannelPrivacy
  memberCount: number
}

export type User = {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  avatarColor: string
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type AttachmentStatus = 'queued' | 'uploading' | 'uploaded' | 'failed'
export type AttachmentError = 'file-too-large' | 'upload-failed' | 'permission-denied'

export type Attachment = {
  id: string
  name: string
  size: number
  status: AttachmentStatus
  uploadProgress?: number
  error?: AttachmentError
  contentType?: string
  storageKey?: string
  downloadUrl?: string
}

export type Message = {
  id: string
  channelId: string
  userId: string
  content: string
  timestamp: Date
  status: MessageStatus
  edited?: boolean
  deleted?: boolean
  replyCount?: number
  attachments?: Attachment[]
}

export type ApiError = {
  status: number
  error: string
  message: string
}

export type AuthTokensDto = {
  access_token: string
  refresh_token: string
  access_expires_at: number
  refresh_expires_at: number
}

export type ApiUserDto = {
  id: string
  email: string
  name: string
  workspace_id: string
  role: Role
}

export type AuthSessionDto = AuthTokensDto & {
  user: ApiUserDto
}

export type ApiChannelDto = {
  id: string
  workspace_id: string
  name: string
  is_private: boolean
  created_by: string
  created_at: number
}

export type ApiMessageDto = {
  id: string
  workspace_id: string
  channel_id: string
  sender_id: string
  body_md: string
  thread_root_id: string | null
  created_at: number
  edited_at: number | null
  deleted_at: number | null
}

export type ApiMessageListDto = {
  items: ApiMessageDto[]
  next_cursor: string | null
}

export type ApiThreadSummaryDto = {
  root_message: ApiMessageDto
  reply_count: number
  last_reply_at: number | null
  participants: string[]
}

export type ApiAttachmentDto = {
  id: string
  name: string
  size_bytes: number
  content_type: string | null
  storage_key: string | null
  download_url: string | null
}

export type RealtimeEnvelope = {
  event_type?: string
  workspace_id?: string | null
  channel_id?: string | null
  correlation_id?: string | null
  server_ts?: number
  payload?: Record<string, unknown>
}
