import { requestErrorMessage } from './requestError'

/** Blob 请求的业务异常也只能显示为消息，不能把 JSON 错误当成 Excel 保存。 */
export async function excelResponse(response: unknown): Promise<Blob> {
  const body = response instanceof Blob ? response : (response as { data?: unknown })?.data
  if (body instanceof Blob) {
    if (body.type.includes('json') || body.type.startsWith('text/')) {
      let message: string | undefined
      try {
        const data = JSON.parse(await body.text()) as { message?: unknown }
        if (typeof data.message === 'string') message = data.message
      } catch {
        /* 非 Excel 响应使用统一失败提示。 */
      }
      throw new Error(message || '')
    }
    return body
  }
  const message = (response as { message?: unknown })?.message
  throw new Error(typeof message === 'string' ? message : '')
}

export async function excelErrorMessage(cause: unknown, fallback: string): Promise<string> {
  const body = (cause as { response?: { data?: unknown } })?.response?.data
  if (body instanceof Blob) {
    try {
      const data = JSON.parse(await body.text()) as { message?: unknown }
      if (typeof data.message === 'string' && data.message.trim()) return data.message
    } catch {
      /* 网关返回非 JSON 文件时保留页面中文兜底。 */
    }
  }
  return requestErrorMessage(cause, fallback)
}
