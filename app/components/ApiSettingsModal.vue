<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  busy?: boolean
}>(), {
  busy: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: string): void
}>()

const draft = ref(props.modelValue)

watch(
  () => props.modelValue,
  (next) => {
    draft.value = next
  }
)

const save = () => {
  emit('save', draft.value.trim())
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-lg galynx-surface rounded-xl p-5">
      <div class="flex items-center justify-between">
        <div class="gx-text-section-title text-white">API settings</div>
        <button
          type="button"
          class="px-3 py-1.5 rounded gx-btn-ghost gx-text-label gx-focus"
          :disabled="busy"
          @click="$emit('close')"
        >
          Close
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <label class="block gx-text-label text-white/70">API Base URL</label>
        <input
          v-model="draft"
          class="w-full rounded px-3 py-2 gx-text-body gx-input outline-none"
          placeholder="http://localhost:3000/api/v1"
        />
        <p class="gx-text-caption text-white/50">
          You can enter host only (example: http://localhost:3000). The app will normalize it to /api/v1.
        </p>

        <div class="pt-2 flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded gx-btn-ghost gx-text-body gx-focus"
            :disabled="busy"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded gx-btn-primary gx-text-body gx-focus"
            :disabled="busy || draft.trim().length < 8"
            @click="save"
          >
            {{ busy ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
