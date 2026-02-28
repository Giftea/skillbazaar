import { useState, useEffect } from 'react';
import type { Skill } from '../types';

interface Props {
  skills: Skill[];
}

function useCountUp(target: number, duration = 1400): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let rafId: number;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return count;
}

export default function HeroBanner({ skills }: Props) {
  const totalCalls = skills.reduce((s, k) => s + k.usage_count, 0);
  const count = useCountUp(totalCalls);

  return (
    <div className="hero">
      <div className="hero-grid-bg" />
      <div className="hero-content">
        <h1 className="hero-title">The Autonomous Skill Economy</h1>
        <p className="hero-sub">
          AI agents that pay. Skills that earn.{' '}
          <span style={{ color: 'var(--accent)' }}>Powered by x402 on Base.</span>
        </p>
        {totalCalls > 0 && (
          <div className="hero-counter">
            <span className="hero-counter-num">{count.toLocaleString()}</span>
            <span className="hero-counter-label">skill calls executed</span>
          </div>
        )}
      </div>
    </div>
  );
}
