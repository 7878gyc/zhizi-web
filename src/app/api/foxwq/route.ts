import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供棋谱链接' }, { status: 400 });
    }

    // Extract chessid from various Foxwq URL formats
    let chessid = '';

    // Format 1: https://www.foxwq.com/Mobile/ShareBoard/index.html?chessid=xxx
    const chessidMatch = url.match(/[?&]chessid=([^&]+)/);
    if (chessidMatch) {
      chessid = chessidMatch[1];
    }

    // Format 2: https://share.foxwq.com/xxx or https://share.foxwq.com/#/xxx
    if (!chessid) {
      const shareMatch = url.match(/share\.foxwq\.com\/(?:#\/)?([a-zA-Z0-9]+)/);
      if (shareMatch) {
        chessid = shareMatch[1];
      }
    }

    // Format 3: https://www.foxwq.com/game/xxx
    if (!chessid) {
      const gameMatch = url.match(/foxwq\.com\/game\/([a-zA-Z0-9]+)/);
      if (gameMatch) {
        chessid = gameMatch[1];
      }
    }

    // Format 4: Direct chessid (alphanumeric string)
    if (!chessid && /^[a-zA-Z0-9]{6,}$/.test(url.trim())) {
      chessid = url.trim();
    }

    if (!chessid) {
      return NextResponse.json({ error: '无法从链接中提取棋谱ID，请检查链接格式' }, { status: 400 });
    }

    // Fetch SGF from Foxwq API
    const foxwqUrl = `https://h5.foxwq.com/yehuDiamond/chessbook_local/YHWQFetchChess?chessid=${chessid}`;

    const resp = await fetch(foxwqUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.foxwq.com/',
      },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `野狐API请求失败: ${resp.status}` }, { status: resp.status });
    }

    const data = await resp.json();

    // Extract SGF content from response
    // Foxwq API returns JSON with chess data
    if (data.code !== undefined && data.code !== 0 && data.code !== '0') {
      return NextResponse.json({ error: data.msg || data.message || '野狐返回错误' }, { status: 400 });
    }

    // The SGF content may be in different fields depending on API version
    const sgfContent = data.chess || data.sgf || data.data?.chess || data.data?.sgf || data.result?.chess || data.result?.sgf || '';

    if (!sgfContent) {
      return NextResponse.json({ error: '未获取到棋谱内容，可能是链接无效或棋谱不存在' }, { status: 404 });
    }

    return NextResponse.json({ sgf: sgfContent, chessid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导入棋谱失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
