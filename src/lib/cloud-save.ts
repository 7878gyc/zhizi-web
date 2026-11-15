export interface CloudSaveInput {
  fileName: string;
  blob: Blob;
  /** 已有云棋谱 id/fileKey 时走覆盖更新，否则新建。 */
  sourceRecordId: string | null;
  sourceFileKey: string | null;
  fetchImpl?: typeof fetch;
}

export interface CloudSaveResult {
  recordId: string | null;
  fileKey: string | null;
}

async function readError(resp: Response, fallback: string): Promise<string> {
  const data = await resp.json().catch(() => null);
  return data && typeof data === 'object' && typeof data.error === 'string'
    ? data.error
    : fallback;
}

/**
 * 上传 SGF 到 R2 并写入/更新云棋谱记录。
 *
 * 所有请求都会检查 HTTP 状态，避免 UI 在数据库保存失败时仍提示成功。
 * 新建成功后返回 record.id/fileKey，调用方应保留 source，后续保存走 PATCH，
 * 而不是反复新建重复记录。
 */
export async function uploadSgfToCloud(input: CloudSaveInput): Promise<CloudSaveResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const { fileName, blob, sourceRecordId, sourceFileKey } = input;
  const isOverwrite = sourceRecordId !== null && sourceFileKey !== null;

  const uploadBody: Record<string, unknown> = { fileName, fileSize: blob.size };
  if (isOverwrite) uploadBody.fileKey = sourceFileKey;

  const uploadResp = await fetchImpl('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uploadBody),
  });
  if (!uploadResp.ok) {
    throw new Error(await readError(uploadResp, '获取上传链接失败'));
  }
  const { uploadUrl, fileKey } = await uploadResp.json();
  if (typeof uploadUrl !== 'string' || typeof fileKey !== 'string') {
    throw new Error('上传链接响应异常');
  }

  const putResp = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-go-sgf' },
    body: blob,
  });
  if (!putResp.ok) throw new Error('文件上传到云端失败');

  if (isOverwrite) {
    const patchResp = await fetchImpl(`/api/records/${sourceRecordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (!patchResp.ok) {
      throw new Error(await readError(patchResp, '更新云棋谱失败'));
    }
    return { recordId: sourceRecordId, fileKey };
  }

  const saveResp = await fetchImpl('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileKey, fileSize: blob.size }),
  });
  if (!saveResp.ok) {
    throw new Error(await readError(saveResp, '保存棋谱记录失败'));
  }
  const saveData = await saveResp.json().catch(() => null);
  const record = saveData?.record as { id?: string; fileKey?: string } | undefined;
  if (!record?.id) throw new Error('保存棋谱记录失败');
  return { recordId: record.id, fileKey: record.fileKey ?? fileKey };
}
