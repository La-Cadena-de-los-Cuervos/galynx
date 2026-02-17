<script setup lang="ts">
import type { ConnectionStatus } from '~/types/galynx'

const props = defineProps<{ status: ConnectionStatus }>()

const config = computed(() => {
  if (props.status === 'online') {
    return { label: 'Connected', dotClass: 'bg-emerald-400', chipClass: 'text-emerald-100' }
  }

  if (props.status === 'reconnecting') {
    return { label: 'Reconnecting', dotClass: 'bg-amber-400 animate-pulse', chipClass: 'text-amber-100' }
  }

  return { label: 'Offline', dotClass: 'bg-rose-400', chipClass: 'text-rose-100' }
})
</script>

<template>
  <div class="gx-badge inline-flex items-center gap-2 text-xs" :class="config.chipClass">
    <span class="inline-flex size-2 rounded-full" :class="config.dotClass" aria-hidden="true" />
    <span>{{ config.label }}</span>
  </div>
</template>
