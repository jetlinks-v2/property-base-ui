import type { UserQuery, UserTerm } from '../api/user'
const historyColumn = (column: string) =>
  ['name', 'telephone', 'customerType'].includes(column) ? `customer.${column}` : column
/** 历史行的主档位于 customer，性质仍属于关系；递归转换保留组合条件逻辑。 */
export function historyQuery(query: UserQuery): UserQuery {
  const mapTerm = (term: UserTerm): UserTerm =>
    'terms' in term ? { ...term, terms: term.terms.map(mapTerm) } : { ...term, column: historyColumn(term.column) }
  return {
    ...query,
    terms: query.terms.map(mapTerm),
    sorts: query.sorts?.map((sort) => ({ ...sort, name: historyColumn(sort.name) }))
  }
}
