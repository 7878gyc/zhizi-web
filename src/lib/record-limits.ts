/** 单个 SGF 文件大小上限：5 MiB。预签名上传与入库共用。 */
export const MAX_SGF_FILE_SIZE = 5 * 1024 * 1024;

export function isValidSgfFileSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_SGF_FILE_SIZE
  );
}

export function isValidSgfFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 255 &&
    // 拒绝控制字符，避免日志/响应头出现异常内容
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
