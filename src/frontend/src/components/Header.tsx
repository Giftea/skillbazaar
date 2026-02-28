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
      <div className="header-inner">

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
            <div className="header-brand" style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              SkillBazaar
            </div>
            <div className="header-subtitle" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
              Pay-per-use AI skills on Base
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={onRegister}
            className="register-btn"
          >
            <span className="register-btn-plus">+</span> Register Skill
          </button>

          <div className="header-network">
            <div className="live-dot" />
            <span className="header-network-label" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
              Base Mainnet
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              <span className="header-network-sep">· </span>{balance} USDC
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
