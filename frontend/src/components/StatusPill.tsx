import React from 'react';

interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-800/80 text-slate-300 border-slate-700/60';

  if (norm === 'NORMAL' || norm === 'PASS' || norm === 'HEALTHY' || norm === 'CANONICAL') {
    colorClasses = 'bg-acid-DEFAULT/10 text-acid-light border-acid-DEFAULT/30 shadow-[0_0_12px_rgba(163,230,53,0.15)]';
  } else if (norm === 'HIGH' || norm === 'MACHINE LEARNING' || norm === 'ACTIVE') {
    colorClasses = 'bg-cobalt/15 text-cobalt-glow border-cobalt/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]';
  } else if (norm === 'LOW' || norm === 'WARNING' || norm === 'BELOW NOMINAL' || norm === 'ALERT') {
    colorClasses = 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]';
  } else if (norm === 'BASELINE') {
    colorClasses = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  }

  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border backdrop-blur-md transition-all duration-200 ${padding} ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${norm === 'NORMAL' || norm === 'PASS' ? 'bg-acid-light animate-pulse' : norm === 'HIGH' ? 'bg-cobalt-glow' : norm === 'LOW' ? 'bg-rose-400' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
};

