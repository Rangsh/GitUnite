<script setup lang="ts">
import AccountCards from '@/components/settings/AccountCards.vue'
import SyncOptions from '@/components/settings/SyncOptions.vue'
import DangerZone from '@/components/settings/DangerZone.vue'
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">设置</h1>
    <AccountCards />
    <SyncOptions />
    <DangerZone />
  </div>
</template>
