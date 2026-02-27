import { useState, useEffect } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import SkillCard from './components/SkillCard';
import TryItModal from './components/TryItModal';
import AnalyticsPanel from './components/AnalyticsPanel';
import type { Skill } from './types';

export default function App() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    fetch('/api/skills')
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />

      <StatsBar skills={skills} loading={loading} />

      {loading && (
        <div className="loading-grid">
          {[1, 2, 3].map((i) => (
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

          {/* Divider */}
          <div
            style={{
              maxWidth: 1100,
              margin: '8px auto 24px',
              padding: '0 24px',
              borderTop: '1px solid var(--border)',
            }}
          />

          <AnalyticsPanel skills={skills} />
        </>
      )}

      {selectedSkill && (
        <TryItModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
    </div>
  );
}
