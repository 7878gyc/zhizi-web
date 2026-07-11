import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extractUserHash, AuthError } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { s3Client, r2Bucket } from '@/lib/r2-client';

/** 服务端上传 SGF 到 R2 并保存数据库记录（无 CORS 问题） */
export async function POST(request: NextRequest) {
  try {
    const userHash = await extractUserHash(request);

    const body = await request.json();
    const { content, fileName } = body as {
      content?: string;
      fileName?: string;
    };

    if (!content || !fileName || typeof content !== 'string' || typeof fileName !== 'string') {
      return NextResponse.json({ error: '缺少 content 或 fileName' }, { status: 400 });
    }

    const uuid = randomUUID();
    const fileKey = `records/${userHash}/${uuid}.sgf`;

    // 服务端直接上传到 R2，无需预签名 URL
    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: fileKey,
      Body: Buffer.from(content, 'utf-8'),
      ContentType: 'application/x-go-sgf',
    });

    await s3Client.send(command);

    // 保存数据库记录
    const record = await prisma.record.create({
      data: {
        userHash,
        fileName,
        fileKey,
        fileSize: Buffer.byteLength(content, 'utf-8'),
      },
    });

    return NextResponse.json({ record, fileKey }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Cloud save error:', err);
    return NextResponse.json({ error: '保存到云端失败' }, { status: 500 });
  }
}
