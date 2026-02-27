import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const CATEGORIES = ['web3', 'ai', 'data', 'analytics', 'utility'];

interface FormState {
  name: string;
  description: string;
  publisher_wallet: string;
  price_usd: string;
  category: string;
  server_url: string;
  endpoint_path: string;
}

const EMPTY: FormState = {
  name: '', description: '', publisher_wallet: '',
  price_usd: '', category: 'web3', server_url: '', endpoint_path: '',
};

export default function RegisterModal({ onClose, onSuccess, onError }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((er) => ({ ...er, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!/^[a-z][a-z0-9-]*$/.test(form.name.trim())) e.name = 'Lowercase letters, numbers, hyphens only';
    if (form.description.trim().length < 20) e.description = 'At least 20 characters';
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.publisher_wallet.trim())) e.publisher_wallet = 'Valid 0x address required';
    const price = parseFloat(form.price_usd);
    if (isNaN(price) || price < 0.001 || price > 10) e.price_usd = '$0.001 – $10.00';
    if (!form.server_url.trim().startsWith('http')) e.server_url = 'Must start with http://';
    if (!form.endpoint_path.trim().startsWith('/')) e.endpoint_path = 'Must start with /';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const portMatch = form.server_url.match(/:(\d+)/);
    const port = portMatch ? parseInt(portMatch[1], 10) : 80;
    const endpoint = `${form.server_url.replace(/\/$/, '')}${form.endpoint_path}`;

    try {
      const res = await fetch('/api/skills/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          publisher_wallet: form.publisher_wallet.trim(),
          price_usd: parseFloat(form.price_usd),
          category: form.category,
          endpoint,
          port,
        }),
      });
      const data = await res.json() as { name?: string; error?: string };
      if (!res.ok) {
        onError(`Registration failed: ${data.error ?? res.statusText}`);
      } else {
        onSuccess(`✅ "${data.name}" is now live on SkillBazaar`);
        onClose();
      }
    } catch (err) {
      onError(`Network error: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16 }}>
              Register a Skill
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Publish your skill to the SkillBazaar marketplace
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">

            <Field label="Skill name" error={errors.name}>
              <input className="modal-input" placeholder="my-skill" value={form.name} onChange={set('name')} />
            </Field>

            <Field label="Description (min 20 chars)" error={errors.description}>
              <textarea
                className="modal-input"
                placeholder="What does this skill do?"
                value={form.description}
                onChange={set('description')}
                rows={2}
                style={{ resize: 'vertical', fontFamily: 'var(--sans)' }}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Price (USD)" error={errors.price_usd}>
                <input className="modal-input" placeholder="0.05" type="number" step="0.001" min="0.001" max="10" value={form.price_usd} onChange={set('price_usd')} />
              </Field>
              <Field label="Category">
                <select className="modal-input" value={form.category} onChange={set('category')} style={{ cursor: 'pointer' }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>


            <Field label="Publisher wallet" error={errors.publisher_wallet}>
              <input className="modal-input" placeholder="0x..." value={form.publisher_wallet} onChange={set('publisher_wallet')} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
            </Field>


            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="Server base URL" error={errors.server_url}>
                <input className="modal-input" placeholder="http://localhost:4005" value={form.server_url} onChange={set('server_url')} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
              </Field>
              <Field label="Endpoint path" error={errors.endpoint_path}>
                <input className="modal-input" placeholder="/run/:address" value={form.endpoint_path} onChange={set('endpoint_path')} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
              </Field>
            </div>


            {form.server_url && form.endpoint_path && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', padding: '8px 12px', background: '#0d0d0d', borderRadius: 6, border: '1px solid var(--border)' }}>
                {form.server_url.replace(/\/$/, '')}{form.endpoint_path}
              </div>
            )}

            <button type="submit" className="pay-btn" disabled={submitting}>
              {submitting ? <><div className="spinner" /> Registering…</> : '⚡ Publish to SkillBazaar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: error ? 'var(--red)' : 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
        {label}{error && <span style={{ marginLeft: 8 }}>— {error}</span>}
      </label>
      {children}
    </div>
  );
}
