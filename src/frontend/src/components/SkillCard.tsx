import { useState, useEffect } from 'react';
import type { Skill } from '../types';

interface Props {
  skill: Skill;
  onClick: () => void;
}


const CAT_BORDER: Record<string, string> = {
  web3:      '#6366f1',
  ai:        '#a855f7',
  data:      '#10b981',
  analytics: '#f59e0b',
  utility:   '#64748b',
  security:  '#ef4444',
  defi:      '#22c55e',
  nft:       '#ec4899',
};


const CAT_BADGE: Record<string, string> = {
  security: 'badge-red',
  defi:     'badge-green',
  utility:  'badge-yellow',
  nft:      'badge-purple',
};

function priceColor(price: number): string {
  if (price <= 0.02) return 'var(--green)';
  if (price <= 0.05) return 'var(--yellow)';
  return 'var(--red)';
}

function useHealthCheck(skillName: string): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/skills/${skillName}/health`)
      .then((r) => r.json())
      .then((d: { online: boolean }) => { if (!cancelled) setOnline(d.online); })
      .catch(() => { if (!cancelled) setOnline(false); });
    return () => { cancelled = true; };
  }, [skillName]);
  return online;
}

export default function SkillCard({ skill, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const online = useHealthCheck(skill.name);
  const borderColor = CAT_BORDER[skill.category] ?? '#6366f1';
  const badgeClass = CAT_BADGE[skill.category] ?? 'badge-purple';
  const needsParam = /:address|:token|:ensOrAddress/.test(skill.endpoint);

  return (
    <div
      className="skill-card"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        ...(hovered
          ? { transform: 'translateY(-4px)', borderColor: 'var(--accent-border)', boxShadow: '0 8px 32px rgba(99,102,241,0.12)', borderLeftColor: borderColor }
          : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
    
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${badgeClass}`}>{skill.category}</span>
          {online !== null && (
            <span style={{ fontSize: 10, color: online ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {online ? '🟢 Online' : '🔴 Offline'}
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: priceColor(skill.price_usd) }}>
          ${skill.price_usd.toFixed(2)}
        </span>
      </div>

  
      <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
        {skill.name}
      </div>

  
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, minHeight: 40 }}>
        {skill.description}
      </div>

 
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {skill.usage_count} calls · port {skill.port}
        </div>
        <button className="try-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          {needsParam ? '⚡ Try It' : '⚡ Run'}
        </button>
      </div>
    </div>
  );
}
