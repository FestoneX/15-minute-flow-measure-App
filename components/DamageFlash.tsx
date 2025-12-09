import React, { useEffect, useState } from 'react';

interface Props {
  trigger: boolean;
  onComplete: () => void;
}

export const DamageFlash: React.FC<Props> = ({ trigger, onComplete }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      setActive(true);
      // Flash duration matches animation logic (roughly 800ms to 1s)
      const timer = setTimeout(() => {
        setActive(false);
        onComplete();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Red Vignette Overlay */}
      <div 
        className="absolute inset-0 damage-vignette mix-blend-overlay animate-pulse"
        style={{ animationDuration: '0.3s' }}
      ></div>
      
      {/* Intense Red Border Fade */}
      <div className="absolute inset-0 border-[12px] border-red-600/30 opacity-50 blur-lg"></div>
    </div>
  );
};
