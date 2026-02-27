import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import SkillCard from './components/SkillCard';
import TryItModal from './components/TryItModal';
import AnalyticsPanel from './components/AnalyticsPanel';
import RegisterModal from './components/RegisterModal';
import ToastContainer from './components/Toast';
import type { ToastItem } from './components/Toast';
import type { Skill } from './types';

export default function App() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchSkills = useCallback(() => {
    return fetch('/api/skills')
      .then((r) => r.json())
      .then((data: { skills: Skill[] }) => {
        setSkills(data.skills);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not connect to marketplace. Is the server running on port 3000?');
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  function handleExecuteSuccess(paidUsd: number) {
    addToast(`✅ Skill executed — paid $${paidUsd.toFixed(2)} USDC`, 'success');
    fetchSkills(); // refresh usage counts
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header onRegister={() => setShowRegister(true)} />

      <StatsBar skills={skills} loading={loading} />

      {loading && (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="skills-grid">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>

          <div style={{ maxWidth: 1100, margin: '8px auto 24px', padding: '0 24px', borderTop: '1px solid var(--border)' }} />

          <AnalyticsPanel skills={skills} />
        </>
      )}

      {selectedSkill && (
        <TryItModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onSuccess={handleExecuteSuccess}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSuccess={(msg) => { addToast(msg, 'success'); fetchSkills(); }}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
