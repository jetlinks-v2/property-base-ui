<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import type { SpaceSegment } from '../../../api/archive'
const props = defineProps<{
  space: {
    name?: string
    spaceName?: string
    fullName?: string
    spaceTypeName?: string
    spaceSegments?: SpaceSegment[]
  }
}>()
const { t } = useI18n()
const fields = computed(() => [
  {
    label: t('Archive.spacePath'),
    value:
      props.space.fullName ||
      props.space.spaceSegments?.map((node) => node.name).join('/') ||
      props.space.name ||
      props.space.spaceName ||
      '—'
  }
])
</script>
<template><KvGrid :items="fields" :cols="1" /></template>
