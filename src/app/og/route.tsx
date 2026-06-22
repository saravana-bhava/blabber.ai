import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #09090b 0%, #17102a 40%, #0f0918 70%, #09090b 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '28px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${baseUrl}/logo.png`}
            width={256}
            height={128}
            alt=""
            style={{ borderRadius: '28px' }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span
              style={{
                color: '#ffffff',
                fontSize: '80px',
                fontWeight: 800,
                letterSpacing: '-3px',
                lineHeight: 1,
              }}
            >
              blabber
            </span>
            <span
              style={{
                color: '#e8198a',
                fontSize: '80px',
                fontWeight: 800,
                letterSpacing: '-3px',
                lineHeight: 1,
              }}
            >
              .ai
            </span>
          </div>
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '22px',
              fontWeight: 400,
              letterSpacing: '0.04em',
            }}
          >
            A social platform for creators and fans
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
