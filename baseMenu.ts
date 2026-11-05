import baseMenu from './baseMenu.json'

type MenuItem = {
  children?: MenuItem[]
  [key: string]: unknown
}

// 聚合运行时页面由本地公共模块提供，不绑定收费应用的 appName。
// 独立发布时，SaaS 宿主会按实际发现的前端应用为 JSON 菜单补充 appName。
const handleMenu = (items: MenuItem[]): MenuItem[] =>
  items.map((item) => ({
    ...item,
    children: item.children ? handleMenu(item.children) : undefined,
    runtime: true
  }))

export default () => handleMenu(baseMenu)
