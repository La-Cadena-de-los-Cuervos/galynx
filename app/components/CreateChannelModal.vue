<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create', payload: { name: string; isPrivate: boolean }): void
}>()

const name = ref<string>('')
const isPrivate = ref<boolean>(false)

const canCreate = computed(() => name.value.trim().length > 0)

const create = () => {
  const n = name.value.trim()
  if (!n) return
  emit('create', { name: n, isPrivate: isPrivate.value })
}
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-md galynx-surface rounded-xl p-5">
      <div class="flex items-center justify-between">
        <div class="gx-text-section-title text-white">Create channel</div>
        <button class="px-3 py-1.5 rounded gx-btn-ghost gx-text-label gx-focus" type="button" @click="$emit('close')">
          Close
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <label class="block gx-text-label text-white/60">Name</label>
        <input v-model="name" class="w-full rounded px-3 py-2 gx-text-body gx-input outline-none" placeholder="engineering" />

        <label class="inline-flex items-center gap-2 gx-text-body text-white/80 mt-2">
          <input v-model="isPrivate" type="checkbox" class="accent-teal-400" />
          Private channel
        </label>

        <div class="pt-2 flex justify-end">
          <button
            class="px-4 py-2 rounded gx-btn-primary gx-text-body gx-focus"
            type="button"
            :disabled="!canCreate"
            @click="create"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
