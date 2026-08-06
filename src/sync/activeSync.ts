/** 当前标签页进行中的同步 AbortController（模块级，避免 store 循环依赖） */
let active: AbortController | null = null

export function setActiveSyncController(controller: AbortController | null) {
  active = controller
}

export function abortActiveSync() {
  active?.abort()
}

export function getActiveSyncController() {
  return active
}
