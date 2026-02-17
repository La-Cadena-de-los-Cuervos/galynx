<script setup lang="ts">
type Variant = 'no-channels' | 'empty-channel'

const props = defineProps<{
  variant: Variant
  channelName?: string
  isPrivate?: boolean
}>()

const title = computed(() => (props.variant === 'no-channels' ? 'No channels yet' : 'No messages yet'))
const description = computed(() =>
  props.variant === 'no-channels'
    ? 'Your workspace is ready, but there are no channels available.'
    : 'This channel is ready. Start a conversation.'
)

const channelLabel = computed(() => {
  const name = props.channelName ?? 'this channel'
  return props.isPrivate ? `🔒 ${name}` : `# ${name}`
})
</script>
<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="max-w-md w-full galynx-surface rounded-xl p-6 text-center">
      <h2 class="gx-text-page-title text-white mb-2">
        {{ title }}
      </h2>
      <p class="gx-text-body text-white/70 mb-4">
        {{ description }}
      </p>

      <div v-if="variant === 'no-channels'" class="gx-text-body text-white/70">
        Create your first channel to get started.
      </div>

      <div v-if="variant === 'empty-channel'" class="gx-text-body text-white/70">
        Send the first message in <span class="text-white font-medium">{{ channelLabel }}</span>.
      </div>
    </div>
  </div>
</template>
