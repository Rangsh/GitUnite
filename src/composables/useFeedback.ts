import { createDiscreteApi } from 'naive-ui'
import { zhCN, dateZhCN } from 'naive-ui'

// 脱离组件树的 message / dialog / notification API，
// 使得 store、composable、普通 ts 模块也能弹提示，无需 useMessage/useDialog 必须在 setup 中调用。
// 传入中文 locale，保证按钮文案与 App 内一致。
export const { message, dialog, notification } = createDiscreteApi(
  ['message', 'dialog', 'notification'],
  {
    configProviderProps: {
      locale: zhCN,
      dateLocale: dateZhCN,
    },
  },
)
