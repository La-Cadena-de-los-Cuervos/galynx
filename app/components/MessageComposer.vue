<script setup lang="ts">
import type { Attachment } from '~/types/galynx'

const props = withDefaults(defineProps<{
  draftKey?: string
  uploadQueue?: Attachment[]
  permissionDeniedMessage?: string
}>(), {
  draftKey: 'galynx-main-draft',
  uploadQueue: () => []
})

const emit = defineEmits<{
  (e: 'send', payload: { message: string; files?: File[] }): void
  (e: 'cancel-upload', attachmentId: string): void
}>()

const draft = ref<string>('')
const localFiles = ref<Array<{ id: string; file: File }>>([])
const fileInput = ref<HTMLInputElement | null>(null)
const canSend = computed(() => draft.value.trim().length > 0)
const visibleUploadQueue = computed<Attachment[]>(() => {
  const localQueue = localFiles.value.map((entry) => ({
    id: entry.id,
    name: entry.file.name,
    size: entry.file.size,
    status: 'queued' as const,
    contentType: entry.file.type
  }))
  return [...props.uploadQueue, ...localQueue]
})

const draftStatus = computed(() => {
  if (draft.value.trim().length > 0) return 'Draft saved'
  return 'No draft'
})

const attachmentErrorLabel = (error: Attachment['error']): string => {
  if (error === 'file-too-large') return 'File too large (max 100 MB)'
  if (error === 'permission-denied') return 'Permission denied'
  if (error === 'upload-failed') return 'Upload failed'
  return 'Attachment error'
}

const send = () => {
  const message = draft.value.trim()
  if (!message) return

  emit('send', { message, files: localFiles.value.map((entry) => entry.file) })
  draft.value = ''
  localFiles.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }

  if (import.meta.client) {
    localStorage.removeItem(props.draftKey)
  }
}

const onEnter = () => send()

const openFilePicker = () => {
  fileInput.value?.click()
}

const onFileSelection = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  if (files.length === 0) return

  for (const file of files) {
    localFiles.value.push({
      id: `queued-${crypto.randomUUID()}`,
      file
    })
  }

  target.value = ''
}

const cancelUpload = (attachmentId: string) => {
  const before = localFiles.value.length
  localFiles.value = localFiles.value.filter((entry) => entry.id !== attachmentId)
  if (localFiles.value.length !== before) return
  emit('cancel-upload', attachmentId)
}

onMounted(() => {
  if (!import.meta.client) return

  const saved = localStorage.getItem(props.draftKey)
  if (saved) {
    draft.value = saved
  }
})

watch(draft, (value) => {
  if (!import.meta.client) return

  if (value.trim().length > 0) {
    localStorage.setItem(props.draftKey, value)
    return
  }

  localStorage.removeItem(props.draftKey)
})
</script>

<template>
  <div>
    <input ref="fileInput" type="file" multiple class="hidden" @change="onFileSelection" />

    <div v-if="visibleUploadQueue.length > 0" class="mb-3 space-y-2">
      <div
        v-for="item in visibleUploadQueue"
        :key="item.id"
        class="galynx-surface rounded-lg p-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="gx-text-body text-slate-100 truncate">{{ item.name }}</div>
            <div class="gx-text-label gx-muted">{{ (item.size / (1024 * 1024)).toFixed(1) }} MB</div>
          </div>

          <button
            type="button"
            class="text-xs px-2.5 py-1 rounded border gx-border text-slate-300 hover:bg-white/10 transition gx-focus"
            @click="cancelUpload(item.id)"
          >
            Cancel
          </button>
        </div>

        <div v-if="item.status === 'uploading'" class="mt-2 h-1.5 rounded bg-slate-900/70 overflow-hidden">
          <div class="h-full bg-cyan-400/85" :style="{ width: `${item.uploadProgress ?? 0}%` }" />
        </div>

        <div v-if="item.status === 'failed'" class="mt-1 gx-text-caption text-rose-300">
          {{ attachmentErrorLabel(item.error) }}
        </div>
      </div>
    </div>

    <div class="rounded-xl border gx-border bg-slate-900/55 p-3.5">
      <div class="flex items-end gap-2">
        <button
          type="button"
          class="h-10 px-3 rounded-lg gx-btn-ghost gx-focus"
          @click="openFilePicker"
        >
          📎
        </button>

        <textarea
          v-model="draft"
          class="flex-1 min-h-[44px] max-h-[140px] rounded-lg px-3 py-2 gx-text-body outline-none gx-input"
          placeholder="Write a message... (Markdown supported)"
          @keydown.enter.exact.prevent="onEnter"
          @keydown.enter.shift.exact="() => {}"
        />

        <button
          type="button"
          class="h-10 px-4 rounded-lg gx-text-body gx-btn-primary gx-focus"
          :disabled="!canSend"
          @click="send"
        >
          Send
        </button>
      </div>

      <div class="mt-2 flex items-center justify-between gx-text-caption gx-muted">
        <span>Enter to send • Shift+Enter for newline</span>
        <span>{{ draftStatus }}</span>
      </div>

      <div v-if="permissionDeniedMessage" class="mt-2 gx-text-label text-rose-300">
        {{ permissionDeniedMessage }}
      </div>
    </div>
  </div>
</template>
