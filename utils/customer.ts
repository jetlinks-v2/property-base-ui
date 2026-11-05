import type { CustomerCreate, CustomerProfile, RelationInput } from '../api/archive'
/** 企业请求剔除个人证件与客户性质，切换类型时不泄漏隐藏表单值。 */
export function profilePayload(model: CustomerProfile, type: 'person' | 'company'): CustomerProfile {
  const common = {
    name: model.name.trim(),
    telephone: model.telephone.trim(),
    email: model.email || undefined,
    address: model.address || undefined
  }
  return type === 'person'
    ? {
        ...common,
        certificateType: model.certificateType || undefined,
        certificateNumber: model.certificateNumber || undefined
      }
    : {
        ...common,
        creditCode: model.creditCode || undefined,
        legalRepresentative: model.legalRepresentative || undefined,
        registeredAddress: model.registeredAddress || undefined
      }
}
export function relationshipPayload(model: RelationInput, type: 'person' | 'company'): RelationInput {
  return type === 'company' ? { spaceId: model.spaceId } : { spaceId: model.spaceId, nature: model.nature }
}
export function createPayload(
  userId: string,
  customerType: 'person' | 'company',
  profile: CustomerProfile,
  relation: RelationInput
): CustomerCreate {
  return {
    userId,
    customerType,
    ...profilePayload(profile, customerType),
    ...relationshipPayload(relation, customerType)
  }
}
