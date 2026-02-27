import type { Skill } from '../types';

interface Props {
  skills: Skill[];
  loading: boolean;
}

export default function StatsBar({ skills, loading }: Props) {
  const totalUsage = skills.reduce((sum, s) => sum + s.usage_count, 0);
  const categories = [...new Set(skills.map((s) => s.category))];
  const avgPrice =
    skills.length > 0
      ? (skills.reduce((sum, s) => sum + s.price_usd, 0) / skills.length).toFixed(3)
      : '0';

  const stats = [
    { label: 'Skills listed', value: loading ? '—' : String(skills.length) },
    { label: 'Categories',    value: loading ? '—' : String(categories.length) },
    { label: 'Total calls',   value: loading ? '—' : String(totalUsage) },
    { label: 'Avg price',     value: loading ? '—' : `$${avgPrice}` },
  ];

  return (
    <div
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
          gap: 0,
          overflowX: 'auto',
        }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              padding: '14px 24px',
              borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--accent)',
                lineHeight: 1.2,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
