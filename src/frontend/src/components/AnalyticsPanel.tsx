import { useState, useEffect, useCallback } from 'react';
import type { Analytics, Skill } from '../types';

interface Props {
  skills: Skill[];
}

const REFRESH_INTERVAL = 30_000; 

const CAT_COLOR: Record<string, string> = {
  security:  'var(--red)',
  defi:      'var(--green)',
  web3:      '#3b82f6',
  ai:        'var(--accent)',
  data:      '#06b6d4',
  analytics: 'var(--yellow)',
  utility:   '#a78bfa',
  nft:       '#ec4899',
};

function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? 'var(--accent)';
}

function useSecondsAgo(isoTimestamp: string | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isoTimestamp) return;
    const update = () =>
      setSeconds(Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isoTimestamp]);

  return seconds;
}

export default function AnalyticsPanel({ skills }: Props) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);

  const fetchAnalytics = useCallback(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((data: Analytics) => {
        setAnalytics(data);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAnalytics]);

  const secondsAgo = useSecondsAgo(analytics?.last_updated ?? null);

  // bar chart data from live skills prop (stays current without waiting for analytics refresh)
  const maxCalls = Math.max(...skills.map((s) => s.usage_count), 1);

  const topSkill = analytics
    ? analytics.top_skills[0]
    : null;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 24px 48px',
        animation: 'fade-in 0.4s ease both',
        animationDelay: '0.1s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          paddingTop: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Marketplace Stats</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {analytics
            ? `Last updated ${secondsAgo}s ago`
            : error
            ? 'Could not load analytics'
            : 'Loading…'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        {[
          {
            label: 'Total Skills',
            value: analytics ? String(analytics.total_skills) : '—',
            accent: false,
          },
          {
            label: 'Total Calls Made',
            value: analytics ? String(analytics.total_calls) : '—',
            accent: false,
          },
          {
            label: 'Total Revenue Generated',
            value: analytics ? `$${analytics.total_revenue_usd.toFixed(2)} USDC` : '—',
            accent: true,
          },
          {
            label: 'Top Skill',
            value: topSkill ? `${topSkill.name}` : '—',
            sub: topSkill ? `${topSkill.usage_count} calls` : undefined,
            accent: false,
          },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${card.accent ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              {card.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                fontSize: 18,
                color: card.accent ? 'var(--accent)' : 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              {card.value}
            </div>
            {card.sub && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {skills.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Calls per skill
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...skills]
              .sort((a, b) => b.usage_count - a.usage_count)
              .map((skill) => {
                const pct = (skill.usage_count / maxCalls) * 100;
                const color = catColor(skill.category);
                return (
                  <div key={skill.name} className="bar-row">
                    <div className="bar-label">
                      <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {skill.name}
                      </span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 6 }}>
                        {skill.usage_count} calls
                      </span>
                    </div>

                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: color,
                          boxShadow: `0 0 8px ${color}55`,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: color,
                        minWidth: 64,
                        textAlign: 'right',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      {skill.category}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
