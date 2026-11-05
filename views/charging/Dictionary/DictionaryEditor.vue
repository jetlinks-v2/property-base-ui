<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import type { useDictionaryManager } from '../../../hooks/archive/useDictionaryManager'
const props = defineProps<{ state: ReturnType<typeof useDictionaryManager> }>()
const { t } = useI18n()
const k = 'Archive.'
const form = ref<FormInstance>()
const save = async () => {
  await form.value?.validate()
  await props.state.save()
}
</script>
<template>
  <JlDrawerShell
    :open="!!state.editor.value"
    :content-wrapper-style="{ maxWidth: 'calc(100vw - 32px)' }"
    :title="t(k + (state.editor.value === 'type' ? 'dictionaryType' : 'dictionaryItem'))"
    icon="BookOutlined"
    @update:open="state.editor.value = undefined"
  >
    <a-form
      ref="form"
      :model="state.model"
      layout="vertical"
      :disabled="state.busy.value"
    >
      <template v-if="state.editor.value === 'type'">
        <a-form-item
          :label="t(k + 'dictionaryCode')"
          name="code"
          :rules="[{ required: true, pattern: /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, message: t(k + 'codeInvalid') }]"
        >
          <a-input
            v-model:value="state.model.code"
            :disabled="!!state.model.id"
            :maxlength="64"
          />
        </a-form-item>
        <a-form-item
          :label="t(k + 'dictionaryName')"
          name="name"
          :rules="[{ required: true, whitespace: true, message: t(k + 'required') }]"
        >
          <a-input
            v-model:value="state.model.name"
            :maxlength="128"
          />
        </a-form-item>
      </template>
      <template v-else>
        <a-form-item
          :label="t(k + 'itemValue')"
          name="value"
          :rules="[{ required: true, pattern: /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, message: t(k + 'codeInvalid') }]"
        >
          <a-input
            v-model:value="state.model.value"
            :disabled="!!state.model.id"
            :maxlength="64"
          />
        </a-form-item>
        <a-form-item
          :label="t(k + 'itemText')"
          name="text"
          :rules="[{ required: true, whitespace: true, message: t(k + 'required') }]"
        >
          <a-input
            v-model:value="state.model.text"
            :maxlength="128"
          />
        </a-form-item>
      </template>
      <a-form-item :label="t(k + 'enabled')"><a-switch v-model:checked="state.model.enabled" /></a-form-item>
      <a-form-item :label="t(k + 'sortIndex')">
        <a-input-number
          v-model:value="state.model.sortIndex"
          :precision="0"
        />
      </a-form-item>
      <a-form-item :label="t(k + 'description')">
        <a-textarea
          v-model:value="state.model.description"
          :maxlength="1000"
          :rows="3"
        />
      </a-form-item>
    </a-form>
    <template #foot>
      <a-button @click="state.editor.value = undefined">{{ t(k + 'cancel') }}</a-button>
      <j-permission-button
        hasPermission="charging/Dictionary:save"
        type="primary"
        :loading="state.busy.value"
        @click="save"
      >
        {{ t(k + 'save') }}
      </j-permission-button>
    </template>
  </JlDrawerShell>
</template>
