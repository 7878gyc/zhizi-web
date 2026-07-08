import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { extractUserHash, AuthError } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

/** 获取当前用户的棋谱列表 */
export async function GET(request: NextRequest) {
  try {
    const userHash = await extractUserHash(request);

    const records = await prisma.record.findMany({
      where: { userHash },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        gameInfo: true,
      },
    });

    return NextResponse.json({ records });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Records list error:', err);
    return NextResponse.json({ error: '获取列表失败' }, { status: 500 });
  }
}

/** 保存棋谱记录到数据库 */
export async function POST(request: NextRequest) {
  try {
    const userHash = await extractUserHash(request);

    const body = await request.json();
    const { fileName, fileKey, fileSize, gameInfo } = body as {
      fileName?: string;
      fileKey?: string;
      fileSize?: number;
      gameInfo?: Record<string, unknown>;
    };

    if (!fileName || !fileKey || typeof fileSize !== 'number') {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const record = await prisma.record.create({
      data: {
        userHash,
        fileName,
        fileKey,
        fileSize,
        gameInfo: (gameInfo as Prisma.InputJsonValue) ?? undefined,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Records create error:', err);
    return NextResponse.json({ error: '保存记录失败' }, { status: 500 });
  }
}
