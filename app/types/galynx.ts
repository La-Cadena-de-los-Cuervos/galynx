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
