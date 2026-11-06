import React from 'react';
import {
  LayoutDashboard,
  Database,
  TrendingUp,
  Sparkles,
  BarChart2,
  ShieldCheck,
  FileDown,
  Settings,
  ChevronRight,
  Boxes
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  datasetSummary?: {
    sha256?: string;
    total_stores?: number;
    total_rows?: number;
  } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  datasetSummary
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, badge: 'Live' },
    { id: 'dataset', label: 'Dataset Explorer', icon: Database, badge: datasetSummary?.total_rows != null ? `${(datasetSummary.total_rows / 1000).toFixed(1)}K` : undefined },
    { id: 'analytics', label: 'Sales Analytics', icon: TrendingUp },
    { id: 'forecast', label: 'Prediction Center', icon: Sparkles, badge: 'AI' },
    { id: 'comparison', label: 'Model Comparison', icon: BarChart2 },
    { id: 'diagnostics', label: 'Reliability & Insights', icon: ShieldCheck },
    { id: 'reports', label: 'Reports & Exports', icon: FileDown },
    { id: 'settings', label: 'Settings & About', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-midnight-950/90 backdrop-blur-2xl border-r border-white/[0.07] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Wordmark & Logo */}
        <div className="h-20 flex items-center px-6 border-b border-white/[0.07] gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cobalt to-cobalt-dark flex items-center justify-center shadow-cobalt-glow border border-cobalt-glow/30">
            <Boxes className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-wider text-white">VORTEX</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-acid-DEFAULT/15 text-acid-light border border-acid-DEFAULT/20">AI</span>
            </div>
            <p className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Retail Intelligence</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Platform</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-cobalt/20 text-white border border-cobalt/50 shadow-cobalt-glow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-acid-light rounded-r" />
                )}

                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-cobalt-glow' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-acid-DEFAULT/20 text-acid-light font-bold'
                          : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-cobalt-glow opacity-100' : 'text-slate-500'}`} />
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom Dataset Verification Card */}
        <div className="p-4 border-t border-white/[0.07]">
          <div className="rounded-xl glass-panel p-3.5 space-y-2 border border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dataset SHA-256</span>
              <span className={`w-2 h-2 rounded-full ${datasetSummary?.sha256 ? 'bg-acid-light animate-ping' : 'bg-slate-500'}`} />
            </div>
            <div className="font-mono text-[10px] text-slate-300 truncate bg-black/40 px-2 py-1 rounded border border-white/5">
              {datasetSummary?.sha256 ? `${datasetSummary.sha256.substring(0, 18)}...` : 'Unavailable'}
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>Stores: <strong className="text-white font-mono">{datasetSummary?.total_stores ?? '—'}</strong></span>
              <span>Records: <strong className="text-white font-mono">{datasetSummary?.total_rows?.toLocaleString() ?? '—'}</strong></span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
