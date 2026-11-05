import React from 'react';

interface BentoCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  title,
  subtitle,
  badge,
  headerAction,
  children,
  className = '',
  glow = false,
}) => {
  return (
    <div className={`relative rounded-2xl glass-panel p-5 sm:p-6 transition-all duration-300 card-3d-wrap ${glow ? 'shadow-cobalt-glow border-cobalt/30' : ''} ${className}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-cobalt-light" />
              {title}
            </h3>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1 pl-3.5">{subtitle}</p>}
        </div>

        {headerAction && (
          <div className="flex items-center gap-2 shrink-0">
            {headerAction}
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

