<script setup lang="ts">
const route = useRoute()

const isDesktopShellRoute = computed(() => route.path === '/')
</script>

<template>
  <div
    class="min-h-screen w-full"
    :class="isDesktopShellRoute ? '' : 'px-4 py-4 lg:px-6'"
  >
    <div
      class="w-full overflow-hidden border gx-border shadow-2xl shadow-slate-950/60"
      :class="isDesktopShellRoute
        ? 'min-h-screen'
        : 'min-h-[calc(100vh-2rem)] max-w-[1440px] mx-auto rounded-2xl'"
    >
      <NuxtPage />
      <ScreenNavigator />
    </div>
  </div>
</template>
