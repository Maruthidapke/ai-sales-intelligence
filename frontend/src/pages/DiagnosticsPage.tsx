import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingDown,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine
} from 'recharts';

import { apiClient } from '../api/client';
import { BentoCard } from '../components/BentoCard';
import { MetricCard } from '../components/MetricCard';
import { StatusPill } from '../components/StatusPill';
import { DiagnosticsData } from '../types/api';

export const DiagnosticsPage: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getDiagnostics();
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 border-2 border-cobalt-light border-t-transparent rounded-full animate-spin shadow-cobalt-glow" />
        <p className="text-xs font-mono text-slate-400">Loading forecast reliability diagnostics...</p>
      </div>
    );
  }

  const storeCoverageData = (data.prediction_intervals.store_coverage_details || []).map((s) => ({
    store: `S${s.store}`,
    storeNum: s.store,
    coverage: s.coverage,
    legacy: s.legacy_coverage,
  }));

  return (
    <div className="space-y-6">
      {/* Top Section: Prediction Interval Coverage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Updated Unified Coverage"
          value="98.89%"
          subtitle="Mean Band Width: $340,857.45"
          accent="acid"
        />

        <MetricCard
          title="Replaced Legacy Coverage"
          value="94.44%"
          subtitle="Mean Band Width: $210,666.28"
          accent="cobalt"
        />

        <MetricCard
          title="Undercovered Stores"
          value="1 / 45 Stores"
          subtitle="Store 36: 78.57% (Below 90% Nominal)"
          accent="acid"
        />
      </div>

      {/* 45-Store Empirical Coverage Bar Chart */}
      <BentoCard
        title="45-Store Empirical Holdout Coverage vs Nominal 90% Target"
        subtitle="Individual store coverage exposes localized failures hidden by aggregate statistics"
        headerAction={
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cobalt-light inline-block" /> Unified (98.89%)
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Store 36 (&lt;90%)
            </span>
          </div>
        }
      >
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storeCoverageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="store" tick={{ fill: '#64748B', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1E293B' }} />
              <YAxis
                domain={[0, 105]}
                tick={{ fill: '#64748B', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => [`${val}%`, 'Holdout Coverage']}
              />
              <ReferenceLine y={90} stroke="#A3E635" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Nominal 90%', fill: '#A3E635', fontSize: 10 }} />
              <Bar dataKey="coverage" radius={[2, 2, 0, 0]}>
                {storeCoverageData.map((entry) => (
                  <Cell
                    key={`store-cov-${entry.storeNum}`}
                    fill={entry.storeNum === 36 ? '#F43F5E' : '#3B82F6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 text-center">
          Store 14 dramatically improved from 7.14% (legacy) to 92.86% in the unified workflow, but Store 36 remains at 78.57%.
        </p>
      </BentoCard>

      {/* Feature Ablation & Warning Utility (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ablation Analysis Card */}
        <BentoCard
          title="Controlled Feature Ablation Analysis"
          subtitle="Impact of removing annual lag features (lags 51, 52, 53 & prior_year_mean_3)"
        >
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-2.5">Model</th>
                    <th className="py-2 px-2.5 text-right">All-Fold MAE &Delta;</th>
                    <th className="py-2 px-2.5 text-right">Fold 1 Share</th>
                    <th className="py-2 px-2.5 text-right">Later Folds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.feature_ablation.models.map((m) => (
                    <tr key={m.model} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2.5 font-bold text-white">{m.model}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-rose-400">+{m.all_fold_mae_change_pct.toFixed(1)}%</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-acid-light font-bold">{m.first_fold_share_pct.toFixed(1)}%</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{m.later_fold_mean_change_pct > 0 ? '+' : ''}{m.later_fold_mean_change_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-midnight-900 border border-white/[0.06] text-xs text-slate-300 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Info className="w-4 h-4 text-cobalt-glow" />
                <span>Non-Uniform Temporal Importance</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {data.feature_ablation.key_insight}
              </p>
            </div>
          </div>
        </BentoCard>

        {/* Warning Utility Matrix Card */}
        <BentoCard
          title="Sales Movement Warning Utility Matrix"
          subtitle="Evaluated against true material sales movements (&plusmn;15% from 13W mean)"
        >
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-2.5">Rule Strategy</th>
                    <th className="py-2 px-2.5 text-right">Alerts</th>
                    <th className="py-2 px-2.5 text-right">Precision</th>
                    <th className="py-2 px-2.5 text-right">Recall</th>
                    <th className="py-2 px-2.5 text-right">False Alarms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.warning_utility.rules.map((r) => (
                    <tr key={r.rule} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2.5 font-bold text-white">{r.rule}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{r.alerts}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-acid-light font-bold">
                        {r.precision !== null ? `${r.precision.toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-cobalt-glow">
                        {r.recall.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">{r.false_alarms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-midnight-900 border border-white/[0.06] text-xs text-slate-300 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <AlertTriangle className="w-4 h-4 text-acid-light" />
                <span>Operational Review Trade-off</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {data.warning_utility.trade_off_explanation}
              </p>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};

