const STEPS = [
  {
    emoji: '🔍',
    step: 'Step 1',
    title: 'Browse Skills',
    sub: 'Discover pay-per-use tools built by the community',
  },
  {
    emoji: '⚡',
    step: 'Step 2',
    title: 'Pay Instantly',
    sub: 'x402 micropayments settle on Base in milliseconds — no checkout, no API keys',
  },
  {
    emoji: '🤖',
    step: 'Step 3',
    title: 'Get Results',
    sub: 'Your agent or app receives the result. Fully autonomous, end to end.',
  },
];

export default function HowItWorks() {
  return (
    <div className="how-section">
      <div className="how-steps">
        {STEPS.map((s) => (
          <div key={s.step} className="how-step">
            <div className="how-step-emoji">{s.emoji}</div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--mono)',
                color: 'var(--text-dim)',
                marginBottom: 6,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {s.step}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
