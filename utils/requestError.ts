/** 优先展示业务响应；请求库的 HTTP/网络异常使用页面中文兜底，避免泄漏技术报错。 */
export function requestErrorMessage(cause: unknown, fallback: string): string {
  if (!cause || typeof cause !== 'object') return fallback
  const error = cause as { isAxiosError?: boolean; response?: { data?: { message?: unknown } } }
  const message = error.response?.data?.message
  if (typeof message === 'string' && message.trim()) return message
  return !error.isAxiosError && cause instanceof Error && cause.message ? cause.message : fallback
}
