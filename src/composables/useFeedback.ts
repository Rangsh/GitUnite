import { computed, ref } from 'vue'
import {
  createDiscreteApi,
  zhCN, dateZhCN, enUS, dateEnUS,
} from 'naive-ui'
import { detectDefaultLocale, type AppLocale } from '@/i18n'

// 脱离组件树的 message / dialog / notification API，
// 使得 store、composable、普通 ts 模块也能弹提示，无需 useMessage/useDialog 必须在 setup 中调用。
const feedbackLocale = ref<AppLocale>(detectDefaultLocale())

/** 与 App 界面语言同步，供 discrete API 的确认按钮等文案切换 */
export function setFeedbackLocale(locale: AppLocale) {
  feedbackLocale.value = locale
}

const configProviderProps = computed(() => ({
  locale: feedbackLocale.value === 'zh-CN' ? zhCN : enUS,
  dateLocale: feedbackLocale.value === 'zh-CN' ? dateZhCN : dateEnUS,
}))

export const { message, dialog, notification } = createDiscreteApi(
  ['message', 'dialog', 'notification'],
  { configProviderProps },
)
