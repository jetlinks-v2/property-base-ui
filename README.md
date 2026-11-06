# 物业基础管理公共前端

组织配置、用户管理、空间管理、客户管理、字典配置统一在本模块维护。收费、巡更、报修等业务共用一套基础管理菜单和页面，无需复制实现。

- 模块注册 ID：`property-base-ui`。
- 后端：现有物业基础服务，经 SaaS 网关访问 `/property/**`。
- 菜单：`baseMenu.json`，由 `baseMenu.ts` 提供给宿主初始化。
- 对外资源：`register.ts`；静态引用与类型入口：`public-api.ts`。
- 接入步骤：[引用文档](docs/引用文档.md)。

## 开发与验证

在 `runtime-ui` 执行：

```powershell
pnpm --filter property-base-ui dev
pnpm --filter property-base-ui test
pnpm --filter property-base-ui build
```

单模块构建输出 `modules/property-base-ui/dist`，包含 `baseMenu.json`。

## 数据权限配置

基础菜单涉及的组织、用户、空间资产须在 `baseMenu.json` 声明 `accessSupport.value: support`，与 SaaS 自带菜单保持一致；仅配置 `assetType` 不会提供数据权限候选项。

修复范围仅为本模块已有五个基础菜单，不变更菜单 ID、按钮授权或后端资产校验。更新后重新初始化这些菜单，再在“运维中心 → 应用模版 → 收费管理 → 配置”设置数据权限，并重新保存应用角色授权。按所属组织管理项目时使用“本组织及下级”对应的 `org-include-children` 策略；不要以“不限制”替代组织权限。

菜单声明本身不会授予用户新的数据范围。保存授权后，重新登录普通账号，核对 `/authorize/me` 中角色的组织数据策略及 `/property/organization/_tree` 返回范围，同时验证无关组织不可见。该运行时授权验证需在实际保存配置后执行。

## 目录职责

```text
api/                 公共接口封装和类型
components/          对外复用的项目选择组件
hooks/               页面状态、请求和业务编排
utils/               数据转换、请求错误和文件处理
views/charging/      五个基础页面及内部组件（兼容既有路由编码）
locales/lang/        中文、英文文案
tests/               页面、状态及公共模块接入测试
docs/                引用文档
```

`views/charging`、菜单 `charging/*` 编码和 `/charging/basic/*` 地址是历史兼容标识，不表示公共模块依赖收费模块。不要仅为统一命名修改它们，避免已有菜单与按钮授权失效。

独立仓库：`git@github.com:jetlinks-v2/property-base-ui.git`，维护分支 `2.20`。宿主按引用文档登记 Git 子模块，业务源码不作为 runtime-ui 主仓库的普通目录提交。
