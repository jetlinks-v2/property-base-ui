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
