import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  accent?: 'cobalt' | 'acid' | 'default';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive,
  accent = 'cobalt',
}) => {
  const accentBorder = accent === 'acid' 
    ? 'hover:border-acid-DEFAULT/40 group-hover:shadow-acid-glow' 
    : 'hover:border-cobalt-light/40 group-hover:shadow-cobalt-glow';

  const accentIcon = accent === 'acid'
    ? 'text-acid-light bg-acid-DEFAULT/10 border-acid-DEFAULT/20'
    : 'text-cobalt-glow bg-cobalt/10 border-cobalt/20';

  return (
    <div className={`group relative overflow-hidden rounded-2xl glass-panel p-5 transition-all duration-300 ${accentBorder}`}>
      {/* Background radial highlight */}
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-cobalt/5 rounded-full blur-2xl group-hover:bg-cobalt/10 transition-all pointer-events-none" />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span>{value}</span>
            {trend && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trendPositive ? 'text-acid-light bg-acid-DEFAULT/15' : 'text-rose-400 bg-rose-500/15'}`}>
                {trend}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400/90 pt-1">{subtitle}</p>}
        </div>

        {Icon && (
          <div className={`p-3 rounded-xl border backdrop-blur-md transition-transform duration-300 group-hover:scale-110 ${accentIcon}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Bottom Accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-40 group-hover:opacity-100 transition-opacity ${accent === 'acid' ? 'bg-gradient-to-r from-transparent via-acid-light to-transparent' : 'bg-gradient-to-r from-transparent via-cobalt-light to-transparent'}`} />
    </div>
  );
};

