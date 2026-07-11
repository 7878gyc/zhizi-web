import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractUserHash, AuthError } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { s3Client, r2Bucket } from '@/lib/r2-client';

/** 为指定棋谱记录生成预签名下载 URL */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userHash = await extractUserHash(request);
    const { id } = await params;

    // 先查数据库确认记录属于当前用户
    const record = await prisma.record.findFirst({
      where: { id, userHash },
      select: { fileKey: true },
    });

    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    const command = new GetObjectCommand({
      Bucket: r2Bucket,
      Key: record.fileKey,
    });

    // @ts-expect-error pnpm may produce mismatched @smithy/types versions across AWS SDK packages
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return NextResponse.json({ downloadUrl });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Download presign error:', err);
    return NextResponse.json({ error: '生成下载链接失败' }, { status: 500 });
  }
}
