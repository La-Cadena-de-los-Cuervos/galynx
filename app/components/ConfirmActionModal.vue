<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
}>(), {
  confirmLabel: 'Delete',
  busy: false
})

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-md galynx-surface rounded-xl p-5">
      <div class="flex items-center justify-between gap-3">
        <div class="gx-text-section-title text-white">{{ props.title }}</div>
        <button
          type="button"
          class="px-3 py-1.5 rounded gx-btn-ghost gx-text-label gx-focus"
          :disabled="props.busy"
          @click="emit('cancel')"
        >
          Close
        </button>
      </div>

      <p class="mt-3 gx-text-body text-white/80">
        {{ props.message }}
      </p>

      <div class="pt-4 flex justify-end gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded gx-btn-ghost gx-text-body gx-focus"
          :disabled="props.busy"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded gx-btn-primary gx-text-body gx-focus"
          :disabled="props.busy"
          @click="emit('confirm')"
        >
          {{ props.busy ? 'Working...' : props.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
