import { useState, useEffect } from 'react';

interface Props {
  onRegister: () => void;
}

function useBalance(): string {
  const [balance, setBalance] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/wallet/balance')
      .then((r) => r.json())
      .then((d: { balance_usdc?: string }) => setBalance(d.balance_usdc ?? '—'))
      .catch(() => setBalance('—'));
  }, []);
  return balance ?? '…';
}

export default function Header({ onRegister }: Props) {
  const balance = useBalance();
  return (
    <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
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
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              SkillBazaar
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
              Pay-per-use AI skills on Base
            </div>
          </div>
        </div>

    
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onRegister}
            className="register-btn"
          >
            + Register Skill
          </button>

          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <div className="live-dot" />
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
              Base Mainnet
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              · {balance} USDC
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
