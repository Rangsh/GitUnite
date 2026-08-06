/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

// papaparse 未自带类型，且项目未安装 @types/papaparse；声明用到的最小 API
declare module 'papaparse' {
  export interface UnparseConfig {
    quotes?: boolean | boolean[]
    quoteChar?: string
    escapeChar?: string
    delimiter?: string
    header?: boolean
    newline?: string
  }
  export function unparse(
    data: object[] | { fields: string[], data: unknown[][] },
    config?: UnparseConfig,
  ): string
}

