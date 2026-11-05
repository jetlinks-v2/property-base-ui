import * as apis from './api'
import ProjectSelect from './components/ProjectSelect.vue'
import SpaceInformation from './views/charging/components/SpaceInformation.vue'
import UserIdentityTags from './views/charging/User/UserIdentityTags.vue'

/** 跨模块公开资源；菜单由宿主单独收集，不在业务模块重复注册。 */
export default {
  apis,
  components: { ProjectSelect, SpaceInformation, UserIdentityTags }
}
