<script setup lang="ts"></script>

<template>
  <div class="min-h-screen p-8">
    <div class="max-w-3xl mx-auto galynx-surface rounded-2xl p-6">
      <h1 class="text-xl font-semibold text-white">Galynx Feature Checklist (mock)</h1>
      <ul class="mt-4 space-y-2 text-sm text-white/80 list-disc pl-5">
        <li>3-panel desktop layout</li>
        <li>Markdown message composer</li>
        <li>Threads as side panel</li>
        <li>File uploads (queue + progress)</li>
        <li>Role-based actions (Owner/Admin/Member)</li>
        <li>Connection states (online/reconnecting/offline)</li>
      </ul>

      <div class="mt-6">
        <NuxtLink to="/" class="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-sm text-white/80">Back</NuxtLink>
      </div>
    </div>
  </div>
</template>

