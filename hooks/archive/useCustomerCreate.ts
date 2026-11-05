import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  addRelationship,
  checked,
  createCustomer,
  queryCustomerProfiles,
  type Customer,
  type CustomerProfile,
  type RelationInput,
  type Scope
} from '../../api/archive'
import { queryPropertyUsers, type PropertyUser } from '../../api/user'
import { createPayload, relationshipPayload } from '../../utils/customer'
import { requestErrorMessage } from '../../utils/requestError'

export function useCustomerCreate(scope: Scope, done: () => void) {
  const { t } = useI18n()
  const type = ref<'person' | 'company'>('person')
  const mode = ref<'new' | 'existing'>('new')
  const userId = ref<string>()
  const customerId = ref<string>()
  const users = ref<PropertyUser[]>([])
  const selectedUser = ref<PropertyUser>()
  const customers = ref<Customer[]>([])
  const existingCustomer = ref<Customer>()
  const optionsLoading = ref(false)
  const optionsFailed = ref(false)
  const optionsTotal = ref(0)
  const saving = ref(false)
  const profile = reactive<CustomerProfile>({ name: '', telephone: '' })
  const relation = reactive<RelationInput>({ spaceId: scope.spaceId || '' })
  let generation = 0
  let disposed = false
  const selectedCustomer = () => existingCustomer.value
  async function load(keyword = '') {
    const token = ++generation
    optionsLoading.value = true
    optionsFailed.value = false
    try {
      if (mode.value === 'new') {
        // 客户来源只按稳定 owner 身份与启用状态筛选，不按项目组织裁剪。
        const response = await queryPropertyUsers({
          terms: [
            { column: 'owner', termType: 'eq', value: true },
            { column: 'status', termType: 'eq', value: 1 },
            ...(keyword
              ? [
                  {
                    terms: [
                      { column: 'name', termType: 'like', value: `%${keyword}%` },
                      { column: 'username', termType: 'like', value: `%${keyword}%`, type: 'or' as const },
                      { column: 'telephone', termType: 'like', value: `%${keyword}%`, type: 'or' as const }
                    ]
                  }
                ]
              : [])
          ],
          pageIndex: 0,
          pageSize: 50
        })
        const result = checked(response)
        if (!disposed && token === generation) {
          users.value = result.data
          optionsTotal.value = result.total
        }
      } else {
        const result = checked(
          await queryCustomerProfiles(
            { projectId: scope.projectId },
            {
              terms: keyword ? [{ column: 'name', termType: 'like', value: `%${keyword}%` }] : [],
              pageIndex: 0,
              pageSize: 50
            }
          )
        )
        if (!disposed && token === generation) {
          customers.value = result.data
          optionsTotal.value = result.total
        }
      }
    } catch {
      if (!disposed && token === generation) optionsFailed.value = true
    } finally {
      if (!disposed && token === generation) optionsLoading.value = false
    }
  }
  const search = useDebounceFn((keyword: string) => {
    void load(keyword)
  }, 300)
  watch(
    mode,
    () => {
      userId.value = undefined
      customerId.value = undefined
      void load()
    },
    { immediate: true }
  )
  watch(userId, (value) => {
    const user = users.value.find((item) => item.id === value)
    // 搜索会替换候选列表；已选来源独立保留，避免字段意外解锁。
    selectedUser.value = user
    // 来源资料只在选择时回显，之后用户输入属于本地主档，不回写账号。
    Object.assign(profile, {
      name: user?.name || '',
      telephone: user?.telephone || '',
      email: user?.email || ''
    })
  })
  watch(customerId, (value) => {
    existingCustomer.value = customers.value.find((item) => item.id === value)
  })
  const lockedFields = computed(() => ({
    name: !userId.value || !!selectedUser.value?.name?.trim(),
    telephone: !userId.value || !!selectedUser.value?.telephone?.trim(),
    email: !userId.value || !!selectedUser.value?.email?.trim()
  }))
  async function save() {
    if (saving.value) return
    saving.value = true
    try {
      if (mode.value === 'existing') {
        const customer = selectedCustomer()
        if (!customer) throw new Error(t('Archive.selectCustomer'))
        await addRelationship(scope, customer.id, relationshipPayload(relation, customer.customerType))
      } else {
        if (!userId.value) throw new Error(t('Archive.selectUser'))
        await createCustomer(scope, createPayload(userId.value, type.value, profile, relation))
      }
      if (!disposed) {
        onlyMessage(t('Archive.customerSaved'), 'success')
        done()
      }
    } catch (cause) {
      if (!disposed) onlyMessage(requestErrorMessage(cause, t('Archive.saveFailed')), 'error')
    } finally {
      if (!disposed) saving.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
    generation++
  })
  return {
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
  }
}
