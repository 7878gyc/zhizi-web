import { ImageResponse } from 'next/og';
import { loadCjkFonts } from '@/lib/og-font';

export const alt = '智子围棋 Web — 在线围棋 AI 复盘工具';
// 正方形，便于微信分享卡片完整显示
export const size = { width: 1080, height: 1080 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const fonts = await loadCjkFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          background: '#0F0F23',
          color: '#E0E0E0',
          fontFamily: 'Noto Sans SC, sans-serif',
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, color: '#E8B931' }}>智子围棋 Web</div>
        <div style={{ marginTop: 32, fontSize: 52, color: '#8B8FA3' }}>在线围棋 AI 复盘工具</div>
        <div style={{ marginTop: 56, fontSize: 34, color: '#4A4A6A' }}>
          实时胜率 · 鹰眼诊断 · SGF · 云棋谱库
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
