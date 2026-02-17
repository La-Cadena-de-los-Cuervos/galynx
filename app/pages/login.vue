<script setup lang="ts">
const router = useRouter()
const app = useGalynxApp()

const email = ref('')
const password = ref('')
const formError = ref<string>('')
const authenticating = computed(() => app.state.value.authenticating)

const canContinue = computed(() => email.value.trim().length > 3 && password.value.trim().length > 3)

const go = async () => {
  if (!canContinue.value) return
  formError.value = ''
  try {
    await app.login(email.value.trim(), password.value)
    await router.push('/')
  } catch {
    formError.value = app.state.value.errorMessage ?? 'Could not sign in. Check your credentials.'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="w-full max-w-md galynx-surface rounded-2xl p-7 shadow-2xl shadow-cyan-900/20">
      <div class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border gx-border bg-cyan-500/10 text-cyan-100">
        Desktop secure messaging
      </div>

      <h1 class="gx-text-page-title text-slate-100 mt-4">Sign in to Galynx</h1>
      <p class="gx-text-body gx-muted mt-1">Internal workspace for engineering teams</p>

      <div class="mt-6 space-y-3">
        <label class="block space-y-1">
          <span class="gx-text-label gx-muted">Work email</span>
          <input
            v-model="email"
            class="w-full rounded-lg px-3 py-2.5 gx-text-body gx-input outline-none"
            placeholder="name@company.com"
          />
        </label>

        <label class="block space-y-1">
          <span class="gx-text-label gx-muted">Password</span>
          <input
            v-model="password"
            type="password"
            class="w-full rounded-lg px-3 py-2.5 gx-text-body gx-input outline-none"
            placeholder="••••••••"
          />
        </label>

        <button
          type="button"
          class="w-full h-11 rounded-lg gx-text-body gx-btn-primary gx-focus"
          :disabled="!canContinue || authenticating"
          @click="go"
        >
          {{ authenticating ? 'Signing in...' : 'Continue' }}
        </button>

        <p v-if="formError" class="gx-text-label text-rose-300">
          {{ formError }}
        </p>
      </div>
    </div>
  </div>
</template>
