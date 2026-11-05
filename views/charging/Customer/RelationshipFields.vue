<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RelationInput } from '../../../api/archive'
import type { useDictionaries } from '../../../hooks/archive/useDictionaries'
defineProps<{
  model: RelationInput
  type: 'person' | 'company'
  dictionary: ReturnType<typeof useDictionaries>
  scope?: unknown
}>()
const { t } = useI18n()
</script>
<template>
  <a-form-item
    v-if="type === 'person'"
    :label="t('Archive.nature')"
    name="nature"
    :rules="[{ required: true, message: t('Archive.required') }]"
  >
    <a-select
      v-model:value="model.nature"
      :options="dictionary.options('customer-nature', model.nature)"
    />
  </a-form-item>
</template>
