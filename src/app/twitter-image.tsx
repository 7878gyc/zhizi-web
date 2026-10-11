import { ImageResponse } from 'next/og';

export const alt = 'Zhizi Go Web — AI Go Review';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0F0F23',
          color: '#E0E0E0',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, color: '#E8B931' }}>
          Zhizi Go · AI Review
        </div>
        <div style={{ marginTop: 24, fontSize: 38, color: '#8B8FA3' }}>
          Real-time KataGo analysis for Go players
        </div>
        <div style={{ marginTop: 48, fontSize: 28, color: '#4A4A6A' }}>
          Winrate · Hawk-eye · SGF · Cloud library
        </div>
      </div>
    ),
    { ...size },
  );
}
