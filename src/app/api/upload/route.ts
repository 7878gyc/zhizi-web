import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extractUserHash, AuthError } from '@/lib/auth-server';
import { s3Client, r2Bucket } from '@/lib/r2-client';

export async function POST(request: NextRequest) {
  try {
    const userHash = await extractUserHash(request);

    const body = await request.json();
    const { fileName, fileSize } = body as { fileName?: string; fileSize?: number };

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: '缺少 fileName' }, { status: 400 });
    }

    const uuid = randomUUID();
    const fileKey = `records/${userHash}/${uuid}.sgf`;

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: fileKey,
      ContentType: 'application/x-go-sgf',
      ContentLength: fileSize ?? undefined,
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
