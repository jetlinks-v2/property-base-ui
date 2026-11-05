<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Dayjs } from 'dayjs'
import type { FormInstance } from 'ant-design-vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import '../components/archive-drawer.css'
import type { House, HouseInput } from '../../../api/archive'
import { useDictionaries } from '../../../hooks/archive/useDictionaries'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import SpaceLocation from '../components/SpaceLocation.vue'
import SpaceInformation from '../components/SpaceInformation.vue'
import DictionaryNotice from '../components/DictionaryNotice.vue'
const props = defineProps<{
  open: boolean
  house?: House
  state: { loading: boolean; failed: boolean; saving: boolean; readOnly: boolean }
}>()
const emit = defineEmits<{ close: []; save: [HouseInput]; retry: [] }>()
const { t } = useI18n()
const k = 'Archive.'
const dictionary = useDictionaries()
const form = ref<FormInstance>()
const model = reactive<HouseInput>({})
watch(
  () => props.house,
  (house) => {
    for (const key of Object.keys(model)) delete model[key as keyof HouseInput]
    if (house)
      Object.assign(model, {
        houseType: house.houseType,
        houseState: house.houseState,
        billingArea: house.billingArea,
        buildingArea: house.buildingArea,
        insideArea: house.insideArea,
        deliveryDate: house.deliveryDate,
        remark: house.remark
      })
  },
  { immediate: true }
)
const rules = computed(() => ({
  houseType: [{ required: true, message: t(k + 'required') }],
  houseState: [{ required: true, message: t(k + 'required') }],
  billingArea: [{ required: true, type: 'number' as const, min: 0.01, message: t(k + 'areaRequired') }]
}))
const submit = async () => {
  await form.value?.validate()
  emit('save', { ...model })
}
</script>
<template>
  <JlDrawerShell
    class="charging-drawer"
    :open="open"
    :width="680"
    :content-wrapper-style="{ maxWidth: 'calc(100vw - 32px)' }"
    :title="t(k + (state.readOnly ? 'detail' : house?.completed ? 'editHouse' : 'completeHouse'))"
    icon="HomeOutlined"
    @update:open="emit('close')"
  >
    <a-spin :spinning="state.loading">
      <a-result
        v-if="state.failed"
        status="warning"
        :title="t(k + 'detailFailed')"
      >
        <template #extra>
          <a-button @click="emit('retry')">{{ t(k + 'retry') }}</a-button>
        </template>
      </a-result>
      <template v-else-if="house">
        <SpaceLocation :space="house" />
        <template v-if="state.readOnly">
          <section class="archive-detail-group">
            <h3 class="archive-section-title">
              <AIcon type="HomeOutlined" />
              {{ t(k + 'spaceInformation') }}
            </h3>
            <SpaceInformation :space="house" />
            <KvGrid
              :items="[
                { label: t(k + 'houseType'), value: dictionary.text('house-type', house.houseType) },
                { label: t(k + 'houseState'), value: dictionary.text('house-state', house.houseState) },
                { label: t(k + 'completed'), value: t(k + (house.completed ? 'complete' : 'incomplete')) },
                {
                  label: t(k + 'deliveryDate'),
                  value: house.deliveryDate ? new Date(house.deliveryDate).toLocaleDateString() : '—'
                }
              ]"
            />
          </section>
          <section class="archive-detail-group">
            <h3 class="archive-section-title">
              <AIcon type="AreaChartOutlined" />
              {{ t(k + 'areaInformation') }}
            </h3>
            <KvGrid
              :items="
                (['billingArea', 'buildingArea', 'insideArea'] as const).map((field) => ({
                  label: t(k + field),
                  value: house?.[field] == null ? '—' : house[field] + ' ㎡'
                }))
              "
            />
          </section>
          <section>
            <h3 class="archive-section-title">{{ t(k + 'remark') }}</h3>
            <p class="archive-remark">{{ house.remark || '—' }}</p>
          </section>
        </template>
        <DictionaryNotice
          v-if="!state.readOnly"
          :dictionary="dictionary"
          :codes="['house-type', 'house-state']"
        />
        <a-form
          v-if="!state.readOnly"
          ref="form"
          :model="model"
          :rules="rules"
          layout="vertical"
          class="archive-form"
          :disabled="state.saving || state.readOnly"
        >
          <h3 class="wide archive-section-title">
            <AIcon type="HomeOutlined" />
            {{ t(k + 'spaceInformation') }}
          </h3>
          <a-form-item
            :label="t(k + 'houseType')"
            name="houseType"
          >
            <a-select
              v-model:value="model.houseType"
              :options="dictionary.options('house-type', model.houseType)"
            />
          </a-form-item>
          <a-form-item
            :label="t(k + 'houseState')"
            name="houseState"
          >
            <a-select
              v-model:value="model.houseState"
              :options="dictionary.options('house-state', model.houseState)"
            />
          </a-form-item>
          <h3 class="wide archive-section-title">
            <AIcon type="AreaChartOutlined" />
            {{ t(k + 'areaInformation') }}
          </h3>
          <a-form-item
            v-for="field in ['billingArea', 'buildingArea', 'insideArea'] as const"
            :key="field"
            :label="t(k + field) + ' / ㎡'"
            :name="field"
          >
            <a-input-number
              v-model:value="model[field]"
              :min="field === 'billingArea' ? 0.01 : 0"
              :precision="2"
            />
          </a-form-item>
          <a-form-item
            :label="t(k + 'deliveryDate')"
            name="deliveryDate"
          >
            <a-date-picker
              :value="model.deliveryDate ? String(model.deliveryDate) : undefined"
              value-format="x"
              @change="
                (value: string | Dayjs) => {
                  model.deliveryDate = value ? Number(value) : undefined
                }
              "
            />
          </a-form-item>
          <a-form-item
            class="wide"
            :label="t(k + 'remark')"
            name="remark"
          >
            <a-textarea
              v-model:value="model.remark"
              :maxlength="2000"
              :rows="3"
            />
          </a-form-item>
        </a-form>
      </template>
    </a-spin>
    <template #foot>
      <a-button @click="emit('close')">{{ t(k + (state.readOnly ? 'close' : 'cancel')) }}</a-button>
      <j-permission-button
        v-if="!state.readOnly"
        hasPermission="charging/Space:save"
        type="primary"
        :loading="state.saving"
        :disabled="!house || dictionary.failed.value || dictionary.loading.value"
        @click="submit"
      >
        {{ t(k + 'save') }}
      </j-permission-button>
    </template>
  </JlDrawerShell>
</template>
