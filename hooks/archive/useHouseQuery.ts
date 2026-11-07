import { computed, ref } from 'vue'
import type { ConditionFilterChangePayload } from '@jetlinks-web-core/components/ConditionFilter'
import type { Query } from '../../api/archive'

export function useHouseQuery() {
  const completion = ref<'all' | 'incomplete' | 'complete'>('all')
  const terms = ref([])
  const searchTerms = ref<Query['terms']>([])
  const params = computed<Query>(() => ({
    terms: [
      // 搜索条件先分组，避免 OR 条件绕过资料状态筛选。
      ...(searchTerms.value?.length ? [{ terms: searchTerms.value }] : []),
      ...(completion.value === 'all'
        ? []
        : [{ column: 'completed', termType: 'eq', value: completion.value === 'complete' }])
    ]
  }))
  const change = ({ filter }: ConditionFilterChangePayload) => {
    searchTerms.value = filter.terms as Query['terms']
  }
  return { completion, terms, params, change }
}
