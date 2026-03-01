import { useEffect } from 'react';

interface AuditFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
}

interface AuditReport {
  address: string;
  is_contract: boolean;
  is_verified: boolean;
  contract_name?: string;
  deployer?: string;
  compiler_version?: string;
  eth_balance: string;
  tx_count: number;
  source_available: boolean;
  findings: AuditFinding[];
  risk_score: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  summary: string;
  recommendations: string[];
  analyzed_at: string;
}

interface Props {
  report: AuditReport;
  onClose: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ff4444',
  high:     '#ff8c00',
  medium:   '#f5c518',
  low:      '#4a9eff',
  info:     'var(--text-muted)',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(255,68,68,0.08)',
  high:     'rgba(255,140,0,0.08)',
  medium:   'rgba(245,197,24,0.08)',
  low:      'rgba(74,158,255,0.08)',
  info:     'rgba(255,255,255,0.03)',
};

const RISK_BADGE: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#ff4444', color: '#fff' },
  high:     { bg: '#ff8c00', color: '#fff' },
  medium:   { bg: '#f5c518', color: '#000' },
  low:      { bg: '#4a9eff', color: '#fff' },
  safe:     { bg: 'var(--green)', color: '#000' },
};

function severityIcon(s: string) {
  return { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: 'ℹ️' }[s] ?? '●';
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

export default function AuditReportModal({ report, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const badge = RISK_BADGE[report.risk_score] ?? RISK_BADGE.safe;
  const criticalCount   = report.findings.filter((f) => f.severity === 'critical').length;
  const highCount       = report.findings.filter((f) => f.severity === 'high').length;
  const mediumCount     = report.findings.filter((f) => f.severity === 'medium').length;
  const lowCount        = report.findings.filter((f) => f.severity === 'low').length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        zIndex: 1100,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header bar ── */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
              Smart Contract Audit · Base Mainnet
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              {report.contract_name ? `${report.contract_name}` : truncAddr(report.address)}
            </div>
            {report.contract_name && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {truncAddr(report.address)}
              </div>
            )}
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 6, fontFamily: 'var(--mono)',
            fontWeight: 700, fontSize: 12, letterSpacing: '0.05em',
            background: badge.bg, color: badge.color,
          }}>
            {report.risk_score.toUpperCase()} RISK
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            {new Date(report.analyzed_at).toLocaleString()}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: 6,
              width: 32, height: 32, cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px 64px', width: '100%' }}>

        {/* Metadata row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {/* Contract name */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contract</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {report.contract_name ?? '—'}
            </div>
          </div>

          {/* Deployer */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deployed by</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {report.deployer ? truncAddr(report.deployer) : '—'}
            </div>
            {report.deployer && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{report.deployer}</div>
            )}
          </div>

          {/* Balance */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ETH Balance</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {report.eth_balance} ETH
            </div>
          </div>
        </div>

        {/* Finding counts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Critical', count: criticalCount, color: SEVERITY_COLOR.critical },
            { label: 'High',     count: highCount,     color: SEVERITY_COLOR.high },
            { label: 'Medium',   count: mediumCount,   color: SEVERITY_COLOR.medium },
            { label: 'Low',      count: lowCount,      color: SEVERITY_COLOR.low },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1px solid ${color}33`,
              background: `${color}11`,
              fontFamily: 'var(--mono)', fontSize: 12,
              color, fontWeight: 600,
              opacity: count === 0 ? 0.35 : 1,
            }}>
              {count} {label}
            </div>
          ))}
        </div>

        {/* Summary */}
        <Section title="Summary">
          <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text)', fontSize: 14 }}>
            {report.summary}
          </p>
        </Section>

        {/* Findings */}
        {report.findings.length > 0 && (
          <Section title={`Findings · ${report.findings.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.findings.map((f, i) => (
                <div key={i} style={{
                  background: SEVERITY_BG[f.severity],
                  border: `1px solid ${SEVERITY_COLOR[f.severity]}33`,
                  borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}`,
                  borderRadius: 8, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{severityIcon(f.severity)}</span>
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
                      color: SEVERITY_COLOR[f.severity],
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {f.severity}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                      {f.title}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <Section title="Recommendations">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.recommendations.map((r, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>→</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {!report.source_available && (
          <div style={{
            marginTop: 24, padding: '14px 16px',
            background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.2)',
            borderRadius: 8, fontSize: 13, color: 'var(--text-muted)',
          }}>
            ⚠ Contract source is not verified on Basescan. The analysis above is based on bytecode heuristics only.
            Verify the source for a complete AI-powered audit.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700,
        color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 14,
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}
