<template>
  <form
    class="flex items-end gap-2 rounded-xl border gx-border bg-white/4 p-2"
    @submit.prevent="handleSubmit"
  >
    <textarea
      v-model="draft"
      class="flex-1 resize-none rounded-lg bg-transparent px-3 py-2 text-sm outline-none
             placeholder:text-white/35 leading-relaxed min-h-[44px] max-h-[140px]"
      placeholder="Write a message..."
      rows="1"
      @keydown.enter.exact.prevent="handleSubmit"
      @keydown.enter.shift.stop
    />

    <button
      class="h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700
             text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="!canSend"
      type="submit"
    >
      Send
    </button>
  </form>

  <div class="mt-2 text-[11px] gx-muted">
    Enter to send • Shift+Enter for newline
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'send', payload: { message: string; files?: File[] }): void
}>()

const draft = ref('')

const canSend = computed(() => draft.value.trim().length > 0)

const handleSubmit = () => {
  const msg = draft.value.trim()
  if (!msg) return

  emit('send', { message: msg })
  draft.value = ''
}
</script>