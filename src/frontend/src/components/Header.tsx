export default function Header() {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '-0.02em',
              }}
            >
              SkillBazaar
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
              Pay-per-use AI skills on Base
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: 20,
          }}
        >
          <div className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
            Base Mainnet
          </span>
        </div>
      </div>
    </header>
  );
}
