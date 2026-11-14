import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { AuthError } from '@/lib/auth-server';
import { resolveUserStorageKey } from '@/lib/user-key';
import { s3Client, r2Bucket } from '@/lib/r2-client';
import { isValidSgfFileName, isValidSgfFileSize } from '@/lib/record-limits';

export async function POST(request: NextRequest) {
  try {
    const userHash = await resolveUserStorageKey(request);

    const body = await request.json();
    const { fileName, fileSize, fileKey: providedFileKey } = body as {
      fileName?: string;
      fileSize?: number;
      fileKey?: string;
    };

    if (!isValidSgfFileName(fileName)) {
      return NextResponse.json({ error: '缺少或非法的 fileName' }, { status: 400 });
    }
    if (!isValidSgfFileSize(fileSize)) {
      return NextResponse.json({ error: '文件大小非法或超过 5MB 限制' }, { status: 400 });
    }

    // Use provided fileKey for overwrite, otherwise generate a new one
    if (providedFileKey) {
      // Security: ensure the provided key belongs to this user
      if (!providedFileKey.startsWith(`records/${userHash}/`)) {
        return NextResponse.json({ error: '无权覆盖此文件' }, { status: 403 });
      }
    }
    const fileKey = providedFileKey ?? `records/${userHash}/${randomUUID()}.sgf`;

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: fileKey,
      ContentType: 'application/x-go-sgf',
      ContentLength: fileSize,
    });

    // @ts-expect-error pnpm may produce mismatched @smithy/types versions across AWS SDK packages
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return NextResponse.json({ uploadUrl, fileKey });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Upload presign error:', err);
    return NextResponse.json({ error: '生成上传链接失败' }, { status: 500 });
  }
}
