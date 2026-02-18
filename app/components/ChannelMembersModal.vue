<script setup lang="ts">
import type { Channel, ChannelMember, WorkspaceMember } from '~/types/galynx'

const props = withDefaults(defineProps<{
  activeChannel?: Channel | null
  workspaceMembers: WorkspaceMember[]
  channelMembers: ChannelMember[]
  busy?: boolean
}>(), {
  activeChannel: null,
  workspaceMembers: () => [],
  channelMembers: () => [],
  busy: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add-channel-member', userId: string): void
  (e: 'remove-channel-member', userId: string): void
  (e: 'upsert-workspace-member', payload: { email: string; role: 'admin' | 'member'; name?: string; password?: string }): void
}>()

const memberForm = reactive({
  email: '',
  name: '',
  password: '',
  role: 'member' as 'admin' | 'member'
})

const channelMemberIds = computed<Set<string>>(() => new Set(props.channelMembers.map((item) => item.userId)))
const availableForChannel = computed(() => props.workspaceMembers.filter((item) => !channelMemberIds.value.has(item.userId)))
const canSubmitWorkspaceMember = computed(() => memberForm.email.trim().length > 0)

const submitWorkspaceMember = () => {
  if (!canSubmitWorkspaceMember.value) return
  emit('upsert-workspace-member', {
    email: memberForm.email.trim(),
    role: memberForm.role,
    name: memberForm.name.trim() || undefined,
    password: memberForm.password.trim() || undefined
  })
  memberForm.email = ''
  memberForm.name = ''
  memberForm.password = ''
  memberForm.role = 'member'
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-3xl galynx-surface rounded-xl p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="gx-text-section-title text-white">Members</div>
          <div class="gx-text-caption gx-muted">
            Workspace members and channel access for
            <span class="text-white/80">{{ activeChannel ? `#${activeChannel.name}` : 'selected channel' }}</span>
          </div>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 rounded gx-btn-ghost gx-text-label gx-focus"
          :disabled="busy"
          @click="$emit('close')"
        >
          Close
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <section class="rounded-lg border gx-border p-3">
          <div class="gx-text-label text-white/80 mb-2">Add/Update workspace member</div>
          <div class="space-y-2">
            <input
              v-model="memberForm.email"
              type="email"
              class="w-full h-9 rounded px-3 gx-input gx-text-body"
              placeholder="email@galynx.local"
            >
            <input
              v-model="memberForm.name"
              type="text"
              class="w-full h-9 rounded px-3 gx-input gx-text-body"
              placeholder="Name (optional)"
            >
            <input
              v-model="memberForm.password"
              type="password"
              class="w-full h-9 rounded px-3 gx-input gx-text-body"
              placeholder="Password (optional)"
            >
            <select v-model="memberForm.role" class="w-full h-9 rounded px-3 gx-input gx-text-body">
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="button"
              class="w-full h-9 rounded gx-btn-primary gx-text-label gx-focus"
              :disabled="busy || !canSubmitWorkspaceMember"
              @click="submitWorkspaceMember"
            >
              {{ busy ? 'Working...' : 'Save workspace member' }}
            </button>
          </div>
        </section>

        <section class="rounded-lg border gx-border p-3">
          <div class="gx-text-label text-white/80 mb-2">Channel members</div>
          <div class="space-y-2 max-h-64 overflow-auto">
            <div
              v-for="member in workspaceMembers"
              :key="member.userId"
              class="rounded-md border border-white/10 px-2.5 py-2 flex items-center justify-between gap-2"
            >
              <div class="min-w-0">
                <div class="gx-text-body text-white truncate">{{ member.name ?? member.email ?? member.userId }}</div>
                <div class="gx-text-caption gx-muted truncate">{{ member.email ?? member.userId }} · {{ member.role }}</div>
              </div>
              <button
                v-if="channelMemberIds.has(member.userId)"
                type="button"
                class="px-2 py-1 rounded gx-btn-ghost gx-text-caption gx-focus"
                :disabled="busy"
                @click="$emit('remove-channel-member', member.userId)"
              >
                Remove
              </button>
              <button
                v-else
                type="button"
                class="px-2 py-1 rounded gx-btn-primary gx-text-caption gx-focus"
                :disabled="busy"
                @click="$emit('add-channel-member', member.userId)"
              >
                Add
              </button>
            </div>
            <div v-if="workspaceMembers.length === 0" class="gx-text-caption gx-muted">
              No workspace members yet.
            </div>
          </div>
          <div class="mt-2 gx-text-caption gx-muted">
            Available to add: {{ availableForChannel.length }}
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
