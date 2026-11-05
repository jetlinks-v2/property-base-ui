<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import '../components/archive-drawer.css'
import SectionCard from '@jetlinks-web-core/components/SectionCard/index.vue'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import type { useCustomerDetail } from '../../../hooks/archive/useCustomerDetail'
import { useDictionaries } from '../../../hooks/archive/useDictionaries'
import CustomerProfileFields from './CustomerProfileFields.vue'
import CustomerRelations from './CustomerRelations.vue'
const props = defineProps<{ state: ReturnType<typeof useCustomerDetail> }>()
const { t } = useI18n()
const k = 'Archive.'
const dictionary = useDictionaries()
const form = ref<FormInstance>()
const customer = computed(() => props.state.customer.value)
const historical = computed(() => props.state.history.value)
const fields = computed(() => {
  const current = customer.value
  if (!current) return []
  const keys = [
    current.customerType === 'company' ? 'companyName' : 'name',
    'telephone',
    'email',
    'address',
    ...(current.customerType === 'person'
      ? ['certificateType', 'certificateNumber']
      : ['creditCode', 'legalRepresentative', 'registeredAddress'])
  ] as const
  return keys.flatMap((key) => {
    const value = current[(key === 'companyName' ? 'name' : key) as keyof typeof current]
    return [
      {
        label: t(k + key),
        value:
          key === 'certificateType'
            ? dictionary.text('certificate-type', current.certificateType)
            : String(value || '—')
      }
    ]
  })
})
const model = computed(() => ({ ...props.state.profile, ...props.state.relation }))
const save = async () => {
  await form.value?.validate()
  await props.state.save()
}
</script>
<template>
  <JlDrawerShell
    class="charging-drawer customer-detail-drawer"
    :open="state.open.value"
    :width="740"
    :content-wrapper-style="{ maxWidth: 'calc(100vw - 32px)' }"
    :title="t(k + (historical ? 'historyDetail' : state.editing.value ? 'editCustomer' : 'customerDetail'))"
    icon="UserOutlined"
    @update:open="state.close"
  >
    <a-spin :spinning="state.loading.value">
      <a-result
        v-if="state.failed.value"
        status="warning"
        :title="t(k + 'detailFailed')"
      >
        <template #extra>
          <a-button @click="state.retry">{{ t(k + 'retry') }}</a-button>
        </template>
      </a-result>
      <div
        v-else-if="customer"
        class="archive-stack"
      >
        <div class="archive-summary">
          <span class="archive-summary__icon">
            <AIcon :type="customer.customerType === 'person' ? 'UserOutlined' : 'BankOutlined'" />
          </span>
          <div>
            <h2>{{ customer.name }}</h2>
            <a-tag color="blue">{{ t(k + customer.customerType) }}</a-tag>
            <a-tag v-if="customer.deleted">{{ t(k + 'deleted') }}</a-tag>
            <a-tag v-if="historical">{{ t(k + 'history') }}</a-tag>
          </div>
        </div>

        <a-form
          v-if="state.editing.value"
          ref="form"
          :model="model"
          layout="vertical"
          :disabled="state.busy.value"
          class="archive-stack"
        >
          <SectionCard
            icon="IdcardOutlined"
            :title="t(k + 'profile')"
          >
            <div class="archive-form">
              <CustomerProfileFields
                :model="state.profile"
                :type="customer.customerType"
                :dictionary="dictionary"
              />
            </div>
          </SectionCard>
          <SectionCard
            v-if="customer.customerType === 'person'"
            icon="TeamOutlined"
            :title="t(k + 'nature')"
          >
            <a-form-item
              :label="t(k + 'nature')"
              name="nature"
              :rules="[{ required: true, message: t(k + 'required') }]"
            >
              <a-select
                v-model:value="state.relation.nature"
                :options="dictionary.options('customer-nature', state.relation.nature)"
              />
            </a-form-item>
          </SectionCard>
        </a-form>
        <SectionCard
          v-else
          icon="IdcardOutlined"
          :title="t(k + 'profile')"
        >
          <KvGrid :items="fields" />
        </SectionCard>
        <CustomerRelations
          v-if="!state.editing.value"
          :relationships="state.record.value ? [state.record.value] : []"
          :person="customer.customerType === 'person'"
          :historical="!!historical"
          :editing="state.editing.value"
          :dictionary="dictionary"
        />
      </div>
    </a-spin>
    <template #foot>
      <a-button @click="state.close">{{ t(k + (state.editing.value ? 'cancel' : 'close')) }}</a-button>
      <j-permission-button
        v-if="state.editing.value"
        hasPermission="charging/Customer:save"
        type="primary"
        :loading="state.busy.value"
        @click="save"
      >
        {{ t(k + 'save') }}
      </j-permission-button>
    </template>
  </JlDrawerShell>
</template>
<style>
.customer-detail-drawer {
  --panel-gap: 12px;
  --panel-padding: 16px;
}
.customer-detail-drawer .archive-stack {
  gap: 16px;
}
/* 分区间距只由容器控制，避免摘要、卡片外边距与 gap 叠加。 */
.customer-detail-drawer .archive-summary,
.customer-detail-drawer .section {
  margin-bottom: 0;
}
.customer-detail-drawer .archive-summary {
  padding-bottom: 16px;
}
.customer-detail-drawer .archive-form {
  gap: 16px 24px;
}
.customer-detail-drawer .ant-form-item,
.customer-detail-drawer .archive-form .ant-form-item {
  margin-bottom: 0;
}
@media (max-width: 680px) {
  .customer-detail-drawer .archive-form {
    grid-template-columns: 1fr;
  }
}
</style>
