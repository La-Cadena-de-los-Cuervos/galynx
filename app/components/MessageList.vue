<script setup lang="ts">
import type { Message, User } from '~/types/galynx'

const props = defineProps<{
  messages: Message[]
  users: User[]
  currentUser: User
}>()

defineEmits<{ (e: 'reply', messageId: string): void }>()
</script>

<template>
  <div class="flex-1 overflow-auto">
    <div class="py-2">
      <div class="px-4 py-2 text-xs text-white/50">Feb 16, 2026</div>

      <MessageItem
        v-for="m in messages"
        :key="m.id"
        :message="m"
        :users="users"
        :currentUser="currentUser"
        @reply="(id) => $emit('reply', id)"
      />
    </div>
  </div>
</template>
