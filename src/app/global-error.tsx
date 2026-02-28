'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '28rem',
          }}
        >
          <div
            style={{
              width: '3rem',
              height: '3rem',
              margin: '0 auto 1rem',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>시스템 오류가 발생했습니다</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
            서비스 이용에 불편을 드려 죄송합니다.
            {error.digest && (
              <span style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                오류 코드: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
