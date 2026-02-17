<script setup lang="ts">
import type { User } from '~/types/galynx'

defineProps<{
  users: User[]
  currentUser: User
}>()

defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-2xl galynx-surface rounded-xl p-5">
      <div class="flex items-center justify-between">
        <div class="gx-text-section-title text-white">User management (mock)</div>
        <button class="px-3 py-1.5 rounded gx-btn-ghost gx-text-label gx-focus" type="button" @click="$emit('close')">
          Close
        </button>
      </div>

      <div class="mt-4 overflow-auto">
        <table class="w-full gx-text-body">
          <thead class="text-white/60 gx-text-label">
            <tr>
              <th class="text-left py-2">Name</th>
              <th class="text-left py-2">Email</th>
              <th class="text-left py-2">Role</th>
              <th class="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-t border-white/10">
              <td class="py-2 text-white">{{ u.name }}</td>
              <td class="py-2 text-white/80">{{ u.email }}</td>
              <td class="py-2 text-white/80">{{ u.role }}</td>
              <td class="py-2">
                <span class="px-2 py-1 rounded gx-text-caption"
                      :class="u.status === 'active' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'">
                  {{ u.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="mt-4 gx-text-label text-white/50">
          Current user: <span class="text-white/80">{{ currentUser.name }}</span> ({{ currentUser.role }})
        </div>
      </div>
    </div>
  </div>
</template>
