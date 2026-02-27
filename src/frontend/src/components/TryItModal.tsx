import { useState, useEffect } from 'react';
import type { Skill, ExecuteResult } from '../types';
import JsonViewer from './JsonViewer';

interface Props {
  skill: Skill;
  onClose: () => void;
  onSuccess: (paidUsd: number) => void;
  onError: (message: string) => void;
}

export default function TryItModal({ skill, onClose, onSuccess, onError }: Props) {
  const needsParam = /:address|:token|:ensOrAddress/.test(skill.endpoint);
  const [param, setParam] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function execute() {
    if (needsParam && !/^(0x[0-9a-fA-F]{40}|.+\.eth)$/.test(param.trim())) {
      setValidationError('Enter a valid 0x EVM address or ENS name (e.g. vitalik.eth).');
      return;
    }
    setValidationError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/skills/${skill.name}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ param: needsParam ? param.trim() : null }),
      });
      const json = await res.json() as ExecuteResult & { error?: string };
      setResult(json);
      if (res.ok) {
        onSuccess(skill.price_usd);
      } else {
        onError(`❌ Execution failed: ${json.error ?? res.statusText}`);
      }
    } catch {
      onError('❌ Network error — is the marketplace server running?');
    } finally {
      setLoading(false);
    }
  }

  const statusColor =
    result?.status === 200 ? 'var(--green)' :
    result?.status === 402 ? 'var(--yellow)' :
    'var(--red)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16 }}>{skill.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{skill.description}</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Price</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
                ${skill.price_usd.toFixed(2)} USDC
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Endpoint</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>
                GET {skill.endpoint.replace('http://localhost:', ':').split('/').slice(1).join('/')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Calls</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{skill.usage_count}</div>
            </div>
          </div>

 
          {needsParam && (
            <div>
              <label htmlFor="param" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                {skill.endpoint.includes(':ensOrAddress') ? 'ENS name or address' : 'EVM Address'}
              </label>
              <input
                id="param"
                className="modal-input"
                placeholder={skill.endpoint.includes(':ensOrAddress') ? 'vitalik.eth or 0x...' : '0x...'}
                value={param}
                onChange={(e) => setParam(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') execute(); }}
                autoFocus
              />
            </div>
          )}

          {validationError && (
            <div style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'var(--mono)' }}>
              ⚠ {validationError}
            </div>
          )}

          <button className="pay-btn" onClick={execute} disabled={loading}>
            {loading ? (
              <><div className="spinner" /> Calling skill…</>
            ) : (
              <>⚡ Execute — ${skill.price_usd.toFixed(2)} USDC</>
            )}
          </button>

          {result && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Response</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: statusColor }}>
                  HTTP {result.status}
                  {result.status === 402 && ' · Payment required (x402)'}
                  {result.status === 200 && ` · Paid $${skill.price_usd.toFixed(2)} USDC`}
                </div>
              </div>
              <JsonViewer data={result.data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
