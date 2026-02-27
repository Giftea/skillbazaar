import { useState } from 'react';
import type { Skill } from '../types';

interface Props {
  skill: Skill;
  onClick: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
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

export default function SkillCard({ skill, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const categoryClass = CATEGORY_COLORS[skill.category] ?? 'badge-purple';
  const needsAddress = skill.endpoint.includes(':address');

  return (
    <div
      className="skill-card"
      style={hovered ? { transform: 'translateY(-4px)', borderColor: 'var(--accent-border)', boxShadow: '0 8px 32px rgba(99,102,241,0.12)' } : {}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span className={`badge ${categoryClass}`}>{skill.category}</span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 15,
            fontWeight: 700,
            color: priceColor(skill.price_usd),
          }}
        >
          ${skill.price_usd.toFixed(2)}
        </span>
      </div>


      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 8,
          color: 'var(--text)',
        }}
      >
        {skill.name}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: 16,
          minHeight: 40,
        }}
      >
        {skill.description}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {skill.usage_count} calls · port {skill.port}
        </div>
        <button className="try-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          {needsAddress ? '⚡ Try It' : '⚡ Run'}
        </button>
      </div>
    </div>
  );
}
