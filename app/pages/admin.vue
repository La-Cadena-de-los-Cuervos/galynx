<script setup lang="ts">
import type { Role } from '~/types/galynx'

type AdminTab = 'users' | 'audit'

const app = useGalynxApp()
const state = app.state
const router = useRouter()
const activeTab = ref<AdminTab>('users')
const creatingUser = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'member' as 'admin' | 'member'
})

const canManage = computed<boolean>(() => {
  const role = state.value.currentUser?.role
  return role === 'owner' || role === 'admin'
})

const auditRows = computed(() => state.value.auditItems)
const usersRows = computed(() => state.value.adminUsers)

const loadTab = async (tab: AdminTab) => {
  if (tab === 'users') await app.loadUsers()
  if (tab === 'audit') await app.loadAudit()
}

const switchTab = async (tab: AdminTab) => {
  activeTab.value = tab
  await loadTab(tab)
}

const createUser = async () => {
  formError.value = null
  if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
    formError.value = 'Name, email and password are required.'
    return
  }

  creatingUser.value = true
  try {
    await app.createUser({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role
    })
    form.name = ''
    form.email = ''
    form.password = ''
    form.role = 'member'
  } catch {
    formError.value = state.value.errorMessage ?? 'Could not create user.'
  } finally {
    creatingUser.value = false
  }
}

const roleBadgeClass = (role: Role): string => {
  if (role === 'owner') return 'bg-amber-500/15 text-amber-100'
  if (role === 'admin') return 'bg-cyan-500/15 text-cyan-100'
  return 'bg-white/10 text-slate-200'
}

onMounted(async () => {
  if (!state.value.initialized) {
    try {
      await app.bootstrap()
    } catch {
      await router.push('/login')
      return
    }
  }
  if (!canManage.value) return
  await loadTab(activeTab.value)
})
</script>

<template>
  <div class="min-h-screen gx-panel text-slate-100">
    <div class="mx-auto max-w-6xl px-6 py-6 space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="gx-text-title text-white">Admin</h1>
          <p class="gx-text-caption gx-muted">Workspace administration panel</p>
        </div>
        <NuxtLink to="/" class="px-3 py-2 rounded gx-btn-ghost gx-text-label gx-focus">
          Back
        </NuxtLink>
      </div>

      <div v-if="!canManage" class="rounded-xl border gx-border bg-rose-500/10 p-4 gx-text-body text-rose-100">
        You do not have permissions to access admin tools.
      </div>

      <template v-else>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded gx-focus gx-text-label"
            :class="activeTab === 'users' ? 'gx-btn-primary' : 'gx-btn-ghost'"
            @click="switchTab('users')"
          >
            Users
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded gx-focus gx-text-label"
            :class="activeTab === 'audit' ? 'gx-btn-primary' : 'gx-btn-ghost'"
            @click="switchTab('audit')"
          >
            Audit
          </button>
        </div>

        <section v-if="activeTab === 'users'" class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <div class="rounded-xl border gx-border p-4 space-y-3">
            <h2 class="gx-text-section-title text-white">Create user</h2>
            <input v-model="form.name" class="w-full h-10 rounded px-3 gx-input gx-text-body" placeholder="Full name">
            <input v-model="form.email" class="w-full h-10 rounded px-3 gx-input gx-text-body" placeholder="email@galynx.local" type="email">
            <input v-model="form.password" class="w-full h-10 rounded px-3 gx-input gx-text-body" placeholder="Password" type="password">
            <select v-model="form.role" class="w-full h-10 rounded px-3 gx-input gx-text-body">
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button type="button" class="w-full h-10 rounded gx-btn-primary gx-text-body gx-focus" :disabled="creatingUser" @click="createUser">
              {{ creatingUser ? 'Creating...' : 'Create user' }}
            </button>
            <p v-if="formError" class="gx-text-caption text-rose-200">{{ formError }}</p>
          </div>

          <div class="rounded-xl border gx-border p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="gx-text-section-title text-white">Users list</h2>
              <button type="button" class="px-3 py-1.5 rounded gx-btn-ghost gx-text-caption gx-focus" :disabled="state.adminUsersLoading" @click="app.loadUsers()">
                {{ state.adminUsersLoading ? 'Loading...' : 'Refresh' }}
              </button>
            </div>
            <div class="overflow-auto max-h-[65vh]">
              <table class="w-full gx-text-body">
                <thead class="text-white/60 gx-text-label">
                  <tr>
                    <th class="text-left py-2">Name</th>
                    <th class="text-left py-2">Email</th>
                    <th class="text-left py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in usersRows" :key="user.id" class="border-t border-white/10">
                    <td class="py-2 text-white">{{ user.name }}</td>
                    <td class="py-2 text-white/80">{{ user.email }}</td>
                    <td class="py-2">
                      <span class="px-2 py-1 rounded gx-text-caption" :class="roleBadgeClass(user.role)">{{ user.role }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="usersRows.length === 0 && !state.adminUsersLoading" class="gx-text-caption gx-muted py-4">
                No users yet.
              </div>
            </div>
          </div>
        </section>

        <section v-else class="rounded-xl border gx-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="gx-text-section-title text-white">Audit log</h2>
            <button type="button" class="px-3 py-1.5 rounded gx-btn-ghost gx-text-caption gx-focus" :disabled="state.auditLoading" @click="app.loadAudit()">
              {{ state.auditLoading ? 'Loading...' : 'Refresh' }}
            </button>
          </div>

          <div class="space-y-2 max-h-[65vh] overflow-auto pr-1">
            <div v-for="item in auditRows" :key="item.id" class="rounded-lg border border-white/10 px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <span class="gx-text-label text-white">{{ item.action }}</span>
                <span class="gx-text-caption gx-muted">{{ item.createdAt.toLocaleString() }}</span>
              </div>
              <div class="gx-text-caption text-white/80 mt-1">
                actor: {{ item.actorId }} · {{ item.targetType }}: {{ item.targetId }}
              </div>
            </div>

            <div v-if="auditRows.length === 0 && !state.auditLoading" class="gx-text-caption gx-muted py-4">
              No audit events yet.
            </div>
          </div>

          <div class="pt-3 flex justify-center">
            <button
              v-if="app.hasMoreAudit"
              type="button"
              class="px-3 py-1.5 rounded gx-btn-primary gx-text-caption gx-focus"
              :disabled="state.auditLoadingMore"
              @click="app.loadMoreAudit()"
            >
              {{ state.auditLoadingMore ? 'Loading...' : 'Load more' }}
            </button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
