<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SectionCard from '@jetlinks-web-core/components/SectionCard/index.vue'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import SpaceInformation from '../components/SpaceInformation.vue'
import type { Relationship } from '../../../api/archive'
import type { useDictionaries } from '../../../hooks/archive/useDictionaries'
defineProps<{
  relationships: Relationship[]
  person: boolean
  historical: boolean
  editing: boolean
  dictionary: ReturnType<typeof useDictionaries>
}>()
const { t } = useI18n()
const date = (value?: number) => (value ? new Date(value).toLocaleString() : '—')
</script>
<template>
  <template
    v-for="record in relationships"
    :key="record.id"
  >
    <SectionCard
      icon="ClockCircleOutlined"
      :title="t('Archive.' + (person && !editing ? 'nature' : 'timeInformation'))"
    >
      <KvGrid
        :items="[
          ...(person && !editing
            ? [{ label: t('Archive.nature'), value: dictionary.text('customer-nature', record.nature) }]
            : []),
          { label: t('Archive.startTime'), value: date(record.startTime) },
          ...(historical ? [{ label: t('Archive.endTime'), value: date(record.endTime) }] : [])
        ]"
      />
    </SectionCard>
    <SectionCard
      icon="EnvironmentOutlined"
      :title="t('Archive.spaceInformation')"
    >
      <SpaceInformation :space="record" />
    </SectionCard>
  </template>
</template>
