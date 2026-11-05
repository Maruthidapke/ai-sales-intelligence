import React from 'react';
import { Menu, Sparkles, FileDown, ShieldCheck, Activity } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  activeTab: string;
  onQuickForecast: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  activeTab,
  onQuickForecast,
}) => {
  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Executive Overview', subtitle: 'Real-time retail KPIs and historical performance telemetry' },
    dataset: { title: 'Dataset Explorer', subtitle: 'Verified panel records, schema validation & upload wizard' },
    analytics: { title: 'Sales Analytics', subtitle: 'Seasonal decomposition, store variance & holiday lift metrics' },
    forecast: { title: 'Prediction Center', subtitle: '1-week-ahead forecast engine with calibrated empirical error bands' },
    comparison: { title: 'Model Comparison', subtitle: 'Holdout benchmark, 4-period nested backtesting & baseline analysis' },
    diagnostics: { title: 'Reliability & Insights', subtitle: 'Store-level empirical coverage, feature ablation & alert utility' },
    reports: { title: 'Reports & Exports', subtitle: 'Generate automated executive PDF briefings and raw forecast CSV data' },
    settings: { title: 'Settings & Methodology', subtitle: 'Mathematical formulations, model hyper-parameters & project scope' },
  };

  const current = titles[activeTab] || { title: 'VORTEX Retail AI', subtitle: 'Sales Intelligence' };

  return (
    <header className="sticky top-0 z-30 h-20 bg-midnight-950/80 backdrop-blur-xl border-b border-white/[0.07] px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle + Title & Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{current.title}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-acid-DEFAULT/10 text-acid-light border border-acid-DEFAULT/25">
              <Activity className="w-3 h-3 animate-spin" /> LIVE ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onQuickForecast}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cobalt to-cobalt-light hover:from-cobalt-light hover:to-cobalt text-white text-xs font-semibold shadow-cobalt-glow transition-all duration-200 hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Run Live Forecast</span>
        </button>

        <a
          href="/api/reports/pdf"
          download
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-panel hover:bg-white/[0.08] text-slate-200 text-xs font-medium border border-white/[0.1] transition-all duration-200"
        >
          <FileDown className="w-3.5 h-3.5 text-cobalt-glow" />
          <span className="hidden sm:inline">Export PDF</span>
        </a>

        {/* Verified Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-acid-light" />
          <span>Zero-Leakage Contract</span>
        </div>
      </div>
    </header>
  );
};

