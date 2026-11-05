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
const fields = computed(() =>
  props.space.spaceSegments?.length
    ? props.space.spaceSegments.map((node) => ({ label: node.typeName || t('Archive.spaceName'), value: node.name }))
    : [
        {
          label: props.space.spaceTypeName || t('Archive.spaceName'),
          value: props.space.name || props.space.spaceName || props.space.fullName || '—'
        }
      ]
)
</script>
<template><KvGrid :items="fields" /></template>
