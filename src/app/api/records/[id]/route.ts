import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AuthError, ownsFileKey } from '@/lib/auth-server';
import { resolveUserStorageKey } from '@/lib/user-key';
import { prisma } from '@/lib/prisma';
import { s3Client, r2Bucket } from '@/lib/r2-client';

/** 更新棋谱记录（当前仅支持更新 fileName） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userHash = await resolveUserStorageKey(request);
    const { id } = await params;

    const record = await prisma.record.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    if (record.userHash !== userHash) {
      return NextResponse.json({ error: '无权修改此记录' }, { status: 403 });
    }

    const body = await request.json();
    const { fileName } = body as { fileName?: string };

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: '缺少 fileName' }, { status: 400 });
    }

    const updated = await prisma.record.update({
      where: { id },
      data: { fileName },
    });

    return NextResponse.json({ record: updated });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Records patch error:', err);
    return NextResponse.json({ error: '更新记录失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userHash = await resolveUserStorageKey(request);
    const { id } = await params;

    // 先查数据库，确认 userHash 归属
    const record = await prisma.record.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    if (record.userHash !== userHash) {
      return NextResponse.json({ error: '无权删除此记录' }, { status: 403 });
    }

    // 纵深防御：只允许删除位于当前用户目录下的文件，避免伪造 fileKey 删除他人文件
    if (!ownsFileKey(userHash, record.fileKey)) {
      return NextResponse.json({ error: '无权删除此文件' }, { status: 403 });
    }

    // 删除 R2 文件（幂等：文件不存在也不报错）
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: record.fileKey,
        })
      );
    } catch (e) {
      console.error('R2 delete error (non-fatal):', e);
    }

    // 删除数据库记录
    await prisma.record.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Records delete error:', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
