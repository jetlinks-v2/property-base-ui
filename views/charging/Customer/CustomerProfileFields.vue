<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CustomerProfile } from '../../../api/archive'
import type { useDictionaries } from '../../../hooks/archive/useDictionaries'
defineProps<{
  model: CustomerProfile
  type: 'person' | 'company'
  dictionary: ReturnType<typeof useDictionaries>
  locked?: Partial<Record<'name' | 'telephone' | 'email', boolean>>
}>()
const { t } = useI18n()
const k = 'Archive.'
</script>
<template>
  <a-form-item
    :label="t(k + (type === 'company' ? 'companyName' : 'name'))"
    name="name"
    :rules="[{ required: true, whitespace: true, message: t(k + 'required') }]"
  >
    <a-input
      v-model:value="model.name"
      :disabled="locked?.name"
      :maxlength="128"
    />
  </a-form-item>
  <a-form-item
    :label="t(k + 'telephone')"
    name="telephone"
    :rules="[{ required: true, whitespace: true, message: t(k + 'required') }]"
  >
    <a-input
      v-model:value="model.telephone"
      :disabled="locked?.telephone"
      :maxlength="64"
    />
  </a-form-item>
  <a-form-item
    :label="t(k + 'email')"
    name="email"
    :rules="[{ type: 'email', message: t(k + 'emailInvalid') }]"
  >
    <a-input
      v-model:value="model.email"
      :disabled="locked?.email"
      :maxlength="128"
    />
  </a-form-item>
  <a-form-item
    :label="t(k + 'address')"
    name="address"
  >
    <a-input
      v-model:value="model.address"
      :maxlength="500"
    />
  </a-form-item>
  <template v-if="type === 'person'">
    <a-form-item
      :label="t(k + 'certificateType')"
      name="certificateType"
    >
      <a-select
        v-model:value="model.certificateType"
        allow-clear
        :options="dictionary.options('certificate-type', model.certificateType)"
      />
    </a-form-item>
    <a-form-item
      :label="t(k + 'certificateNumber')"
      name="certificateNumber"
    >
      <a-input
        v-model:value="model.certificateNumber"
        :maxlength="128"
      />
    </a-form-item>
  </template>
  <template v-else>
    <a-form-item
      :label="t(k + 'creditCode')"
      name="creditCode"
    >
      <a-input
        v-model:value="model.creditCode"
        :maxlength="64"
      />
    </a-form-item>
    <a-form-item
      :label="t(k + 'legalRepresentative')"
      name="legalRepresentative"
    >
      <a-input
        v-model:value="model.legalRepresentative"
        :maxlength="128"
      />
    </a-form-item>
    <a-form-item
      class="wide"
      :label="t(k + 'registeredAddress')"
      name="registeredAddress"
    >
      <a-input
        v-model:value="model.registeredAddress"
        :maxlength="500"
      />
    </a-form-item>
  </template>
</template>
