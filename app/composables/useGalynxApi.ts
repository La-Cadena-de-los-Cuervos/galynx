import { invoke } from '@tauri-apps/api/core'
import type {
  ApiAttachmentDto,
  ApiChannelDto,
  ApiMessageDto,
  ApiMessageListDto,
  ApiThreadSummaryDto,
  ApiUserDto,
  AuthSessionDto
} from '~/types/galynx'

const ensureTauri = () => {
  if (!import.meta.client) {
    throw new Error('Tauri API is only available on client runtime.')
  }
}

export const useGalynxApi = () => {
  const authLogin = (email: string, password: string) => {
    ensureTauri()
    return invoke<AuthSessionDto>('auth_login', { payload: { email, password } })
  }

  const authMe = () => {
    ensureTauri()
    return invoke<ApiUserDto>('auth_me')
  }

  const authLogout = () => {
    ensureTauri()
    return invoke<void>('auth_logout')
  }

  const channelsList = () => {
    ensureTauri()
    return invoke<ApiChannelDto[]>('channels_list')
  }

  const channelsCreate = (name: string, isPrivate: boolean) => {
    ensureTauri()
    return invoke<ApiChannelDto>('channels_create', { payload: { name, is_private: isPrivate } })
  }

  const channelsDelete = (channelId: string) => {
    ensureTauri()
    return invoke<void>('channels_delete', { payload: { channel_id: channelId } })
  }

  const messagesList = (channelId: string, limit = 50, cursor?: string) => {
    ensureTauri()
    return invoke<ApiMessageListDto>('messages_list', {
      payload: {
        channel_id: channelId,
        limit,
        cursor
      }
    })
  }

  const messagesSend = (channelId: string, bodyMd: string) => {
    ensureTauri()
    return invoke<ApiMessageDto>('messages_send', {
      payload: {
        channel_id: channelId,
        body_md: bodyMd
      }
    })
  }

  const attachmentsUploadCommit = (
    channelId: string,
    messageId: string,
    filename: string,
    contentType: string,
    bytes: Uint8Array
  ) => {
    ensureTauri()
    return invoke<ApiAttachmentDto>('attachments_upload_commit', {
      payload: {
        channel_id: channelId,
        message_id: messageId,
        filename,
        content_type: contentType,
        size_bytes: bytes.byteLength,
        bytes: Array.from(bytes)
      }
    })
  }

  const messagesEdit = (messageId: string, bodyMd: string) => {
    ensureTauri()
    return invoke<ApiMessageDto>('messages_edit', {
      payload: {
        message_id: messageId,
        body_md: bodyMd
      }
    })
  }

  const messagesDelete = (messageId: string) => {
    ensureTauri()
    return invoke<void>('messages_delete', {
      payload: {
        message_id: messageId
      }
    })
  }

  const threadGet = (rootId: string) => {
    ensureTauri()
    return invoke<ApiThreadSummaryDto>('thread_get', { payload: { root_id: rootId } })
  }

  const threadRepliesList = (rootId: string, limit = 50, cursor?: string) => {
    ensureTauri()
    return invoke<ApiMessageListDto>('thread_replies_list', {
      payload: {
        root_id: rootId,
        limit,
        cursor
      }
    })
  }

  const threadReplySend = (rootId: string, bodyMd: string) => {
    ensureTauri()
    return invoke<ApiMessageDto>('thread_reply_send', {
      payload: {
        root_id: rootId,
        body_md: bodyMd
      }
    })
  }

  const realtimeConnect = () => {
    ensureTauri()
    return invoke<void>('realtime_connect')
  }

  const realtimeDisconnect = () => {
    ensureTauri()
    return invoke<void>('realtime_disconnect')
  }

  const settingsGetApiBase = () => {
    ensureTauri()
    return invoke<string>('settings_get_api_base')
  }

  const settingsSetApiBase = (apiBase: string) => {
    ensureTauri()
    return invoke<string>('settings_set_api_base', { payload: { api_base: apiBase } })
  }

  return {
    authLogin,
    authMe,
    authLogout,
    channelsList,
    channelsCreate,
    channelsDelete,
    messagesList,
    messagesSend,
    attachmentsUploadCommit,
    messagesEdit,
    messagesDelete,
    threadGet,
    threadRepliesList,
    threadReplySend,
    settingsGetApiBase,
    settingsSetApiBase,
    realtimeConnect,
    realtimeDisconnect
  }
}
