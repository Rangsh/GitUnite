<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AccountCards from '@/components/settings/AccountCards.vue'
import SyncOptions from '@/components/settings/SyncOptions.vue'
import DataManagement from '@/components/settings/DataManagement.vue'
import DangerZone from '@/components/settings/DangerZone.vue'
import { Settings } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header>
      <p class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
        <Settings :size="13" /> Preferences
      </p>
      <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">{{ t('settings.title') }}</h1>
      <p class="mt-1.5 text-sm text-ink-500">
        {{ t('settings.subtitle') }}
      </p>
    </header>

    <AccountCards />
    <SyncOptions />
    <DataManagement />
    <DangerZone />
  </div>
</template>
