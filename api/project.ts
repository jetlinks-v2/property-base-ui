import { getSpaceProjects } from './archive'

/** 空间档案和客户档案共用的项目选项；项目权限由提供方及业务后端校验。 */
export interface ProjectOption {
  id: string
  name: string
}

/** 未接入与查询成功但无可选项目分开表达，避免把缺少接口误报为无数据。 */
export type ProjectOptionsResult = { status: 'notConfigured' } | { status: 'ready'; options: ProjectOption[] }

/**
 * 项目列表的唯一接入入口，供空间档案和客户档案共用。
 * 项目来自已标注为项目且有读取权限的组织，与档案页面共用空间接口。
 * 接口失败应按宿主约定抛出错误，不转换成 ready + 空数组。
 */
export const getProjectOptions = async (): Promise<ProjectOptionsResult> => ({
  status: 'ready',
  options: await getSpaceProjects()
})
