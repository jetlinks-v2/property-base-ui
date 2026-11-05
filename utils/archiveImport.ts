/** 文件内容及整批业务校验由后端负责，此处只拦截格式和大小。 */
export function validateImportFile(file: Pick<File, 'name' | 'size'>): 'format' | 'size' | undefined {
  if (!/\.(xlsx|xls)$/i.test(file.name)) return 'format'
  if (file.size > 10 * 1024 * 1024) return 'size'
}
