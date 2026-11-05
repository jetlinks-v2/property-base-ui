<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import '../components/archive-drawer.css'
import type { Scope, Space } from '../../../api/archive'
import { useCustomerCreate } from '../../../hooks/archive/useCustomerCreate'
import { useDictionaries } from '../../../hooks/archive/useDictionaries'
import CustomerProfileFields from './CustomerProfileFields.vue'
import RelationshipFields from './RelationshipFields.vue'
import SpaceLocation from '../components/SpaceLocation.vue'
import DictionaryNotice from '../components/DictionaryNotice.vue'
const props = defineProps<{ scope: Scope; space: Space }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()
const k = 'Archive.'
const form = ref<FormInstance>()
const state = useCustomerCreate(props.scope, () => emit('saved'))
const {
  type,
  mode,
  userId,
  customerId,
  users,
  customers,
  optionsLoading,
  optionsFailed,
  optionsTotal,
  saving,
  profile,
  relation,
  selectedCustomer,
  lockedFields,
  load,
  search,
  save
} = state
const effectiveType = computed(() =>
  mode.value === 'existing' ? selectedCustomer()?.customerType || 'person' : type.value
)
const dictionary = useDictionaries()
const model = computed(() => ({ ...profile, ...relation, userId: userId.value, customerId: customerId.value }))
// Select 的 change 早于组合表单模型更新；有效选择落定后清除上一帧的必填提示。
watch([userId, customerId, () => relation.nature], async (values, previous) => {
  const fields = ['userId', 'customerId', 'nature'].filter(
    (_, index) => values[index] && values[index] !== previous[index]
  )
  await nextTick()
  if (fields.length) form.value?.clearValidate(fields)
})
const submit = async () => {
  await form.value?.validate()
  await save()
}
</script>
<template>
  <JlDrawerShell
    class="charging-drawer"
    :open="true"
    :width="700"
    :content-wrapper-style="{ maxWidth: 'calc(100vw - 32px)' }"
    :title="t(k + 'addCustomer')"
    icon="UserAddOutlined"
    @update:open="emit('close')"
  >
    <SpaceLocation :space="space" />
    <a-radio-group
      class="archive-mode"
      v-model:value="mode"
      button-style="solid"
    >
      <a-radio-button value="new">{{ t(k + 'newCustomer') }}</a-radio-button>
      <a-radio-button value="existing">{{ t(k + 'linkExisting') }}</a-radio-button>
    </a-radio-group>
    <DictionaryNotice
      v-if="effectiveType === 'person'"
      :dictionary="dictionary"
      :codes="['customer-nature', 'certificate-type']"
    />
    <a-form
      ref="form"
      :model="model"
      layout="vertical"
      class="archive-form"
      :disabled="saving"
    >
      <h3 class="wide archive-section-title">
        <AIcon type="IdcardOutlined" />
        {{ t(k + 'customerSource') }}
      </h3>
      <template v-if="mode === 'new'">
        <a-form-item
          class="wide"
          :label="t(k + 'customerType')"
        >
          <a-radio-group v-model:value="type">
            <a-radio value="person">{{ t(k + 'person') }}</a-radio>
            <a-radio value="company">{{ t(k + 'company') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          class="wide"
          :label="t(k + 'sourceUser')"
          name="userId"
          :rules="[{ required: true, message: t(k + 'selectUser') }]"
        >
          <a-select
            v-model:value="userId"
            show-search
            :filter-option="false"
            :loading="optionsLoading"
            :options="
              users.map((item) => ({
                value: item.id,
                label: `${item.name || item.username} · ${item.telephone || item.username}`
              }))
            "
            :placeholder="t(k + 'selectUser')"
            @search="search"
          />
        </a-form-item>
        <h3 class="wide archive-section-title">
          <AIcon type="UserOutlined" />
          {{ t(k + 'profile') }}
        </h3>
        <p class="wide archive-field-hint">{{ t(k + 'customerHint') }}</p>
        <CustomerProfileFields
          :model="profile"
          :locked="lockedFields"
          :type="type"
          :dictionary="dictionary"
        />
      </template>
      <template v-else>
        <a-form-item
          class="wide"
          :label="t(k + 'existingCustomer')"
          name="customerId"
          :rules="[{ required: true, message: t(k + 'selectCustomer') }]"
        >
          <a-select
            v-model:value="customerId"
            show-search
            :filter-option="false"
            :loading="optionsLoading"
            :options="customers.map((item) => ({ value: item.id, label: `${item.name} · ${item.telephone}` }))"
            @search="search"
          />
        </a-form-item>
        <p
          v-if="selectedCustomer()"
          class="wide archive-muted"
        >
          {{ selectedCustomer()?.name }} · {{ selectedCustomer()?.telephone }} · {{ t(k + effectiveType) }}
        </p>
      </template>
      <p
        v-if="optionsTotal > 50"
        class="wide archive-muted"
      >
        {{ t(k + 'refineSearch') }}
      </p>
      <h3
        v-if="effectiveType === 'person'"
        class="wide archive-section-title"
      >
        <AIcon type="TeamOutlined" />
        {{ t(k + 'nature') }}
      </h3>
      <RelationshipFields
        :key="effectiveType"
        :model="relation"
        :type="effectiveType"
        :dictionary="dictionary"
        :scope="scope"
      />
    </a-form>
    <template #foot>
      <a-button @click="emit('close')">{{ t(k + 'cancel') }}</a-button>
      <j-permission-button
        hasPermission="charging/Customer:save"
        type="primary"
        :loading="saving"
        :disabled="optionsFailed || (effectiveType === 'person' && dictionary.failed.value)"
        @click="submit"
      >
        {{ t(k + 'save') }}
      </j-permission-button>
    </template>
  </JlDrawerShell>
</template>
