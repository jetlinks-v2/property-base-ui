<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { accountState } from '../../../utils/userQuery'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import '../components/archive-drawer.css'
import type { PropertyUser, UserIdentity, UserIdentityValue } from '../../../api/user'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import UserIdentityTags from './UserIdentityTags.vue'

const props = defineProps<{
  open: boolean
  user?: PropertyUser
  state: {
    loading: boolean
    failed: boolean
    editable: boolean
    readOnly: boolean
    saving: boolean
    saved: boolean
    saveError: boolean
  }
  identities: UserIdentity[]
}>()
const emit = defineEmits<{ close: []; retry: []; save: [UserIdentityValue[]] }>()
const { t } = useI18n()
const k = 'UserManagement.'
const selected = computed(() => props.user?.identities.map((item) => item.value) || [])
const date = (value?: number) => (value ? new Date(value).toLocaleString() : '—')
const accountType = computed(() => {
  const value = props.user?.accountType
  return value && ['admin', 'user', 'projectOwner'].includes(value) ? t(k + 'accountTypes.' + value) : value || '—'
})
const fields = computed(() => [
  [t(k + 'username'), props.user?.username],
  [t(k + 'telephone'), props.user?.telephone],
  [t(k + 'email'), props.user?.email],
  [t(k + 'accountType'), accountType.value],
  [t(k + 'createTime'), date(props.user?.createTime)],
  [t(k + 'sourceUpdate'), date(props.user?.sourceUpdateTime)]
])
</script>

<template>
  <JlDrawerShell
    class="charging-drawer"
    :open="open"
    :width="640"
    :title="t(k + (state.readOnly ? 'detail' : 'mark'))"
    icon="UserOutlined"
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
      <template v-else-if="user">
        <div class="user-detail-summary">
          <a-avatar
            :size="52"
            class="user-avatar"
          >
            {{ (user.name || user.username).slice(0, 1) }}
          </a-avatar>
          <div class="user-detail-summary__copy">
            <h2>{{ user.name || user.username }}</h2>
            <p>{{ user.username }}</p>
            <UserIdentityTags :identities="user.identities" />
          </div>
          <j-badge-status
            :status="user.status"
            :text="t(k + accountState(user.status))"
            :status-names="{ 1: 'success', 0: 'default' }"
          />
        </div>
        <section class="user-detail-section">
          <div class="user-section-heading">
            <h3>{{ t(k + 'identity') }}</h3>
            <span
              v-if="!state.readOnly && state.saving"
              class="user-muted"
              role="status"
            >
              {{ t(k + 'saving') }}
            </span>
            <span
              v-else-if="!state.readOnly && state.saved"
              class="user-saved"
              role="status"
            >
              {{ t(k + 'saveSuccess') }}
            </span>
            <span
              v-else-if="!state.readOnly"
              class="user-muted"
            >
              {{ t(k + 'autoSave') }}
            </span>
          </div>
          <UserIdentityTags
            v-if="state.readOnly"
            :identities="user.identities"
          />
          <a-checkbox-group
            v-else
            :value="selected"
            :disabled="!state.editable"
            class="user-identity-options"
            @change="(values) => emit('save', values as UserIdentityValue[])"
          >
            <a-checkbox
              v-for="identity in identities"
              :key="identity.value"
              :value="identity.value"
            >
              <span class="user-identity-label">{{ identity.text }}</span>
            </a-checkbox>
          </a-checkbox-group>
          <p
            v-if="!state.readOnly"
            class="user-field-hint"
          >
            {{ t(k + (user.status === 1 ? 'identityHint' : 'disabledHint')) }}
          </p>
        </section>
        <section class="user-detail-section">
          <h3>
            {{ t(k + 'sourceData') }}
          </h3>
          <KvGrid
            :items="fields.map(([label, value]) => ({ label: label || '', value: value || t(k + 'notProvided') }))"
          />
        </section>
        <section class="user-detail-section">
          <h3>{{ t(k + 'organization') }}</h3>
          <div
            v-for="org in user.orgList"
            :key="org.orgId"
            class="user-detail-org"
          >
            <b>{{ org.name || org.orgId }}</b>
            <p>{{ org.fullName || org.name || org.orgId }}</p>
          </div>
          <p
            v-if="!user.orgList.length"
            class="user-muted"
          >
            {{ t(k + 'noOrganization') }}
          </p>
        </section>
        <footer
          v-if="user.modifyTime"
          class="user-detail-audit"
        >
          {{ t(k + 'markedBy', { name: user.modifierName || '—', time: date(user.modifyTime) }) }}
        </footer>
      </template>
    </a-spin>
    <template #foot>
      <a-button @click="emit('close')">{{ t('Archive.close') }}</a-button>
    </template>
  </JlDrawerShell>
</template>

<style scoped src="./detail.css"></style>
