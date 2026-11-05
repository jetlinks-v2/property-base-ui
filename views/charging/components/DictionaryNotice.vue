<script setup lang="ts">
import { watch } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'
import type { DictionaryCode, useDictionaries } from '../../../hooks/archive/useDictionaries'
const props = defineProps<{ dictionary: ReturnType<typeof useDictionaries>; codes: DictionaryCode[] }>()
const { t } = useI18n()
watch(
  () => props.dictionary.failed.value,
  (failed) => {
    if (failed) onlyMessage(t('Archive.dictionaryFailed'), 'error')
  },
  { immediate: true }
)
</script>
<template>
  <a-alert
    v-if="
      !dictionary.failed.value && !dictionary.loading.value && codes.some((code) => !dictionary.options(code).length)
    "
    type="warning"
    show-icon
    :message="t('Archive.dictionaryEmpty')"
  >
    <template #action>
      <a-space>
        <a-button
          size="small"
          @click="dictionary.reload"
        >
          {{ t('Archive.retry') }}
        </a-button>
        <router-link to="/charging/basic/dictionaries">{{ t('Archive.manageDictionary') }}</router-link>
      </a-space>
    </template>
  </a-alert>
</template>
