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
import { DiagnosticsData, LeakageAudit } from '../types/api';
import { useForecastScope } from '../state/ForecastScopeContext';

export const DiagnosticsPage: React.FC = () => {
  const { scope } = useForecastScope();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [audit, setAudit] = useState<LeakageAudit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setData(null);
        setAudit(null);
        setLoadError(null);
        const [diagnostics, auditResult] = await Promise.allSettled([
          apiClient.getDiagnostics(scope.storeId),
          apiClient.getLeakageAudit(scope.storeId),
        ]);
        if (diagnostics.status === 'fulfilled') setData(diagnostics.value);
        else setLoadError((diagnostics.reason as any)?.response?.data?.detail || 'Reliability diagnostics could not be loaded from the backend.');
        if (auditResult.status === 'fulfilled') setAudit(auditResult.value);
        else setLoadError((auditResult.reason as any)?.response?.data?.detail || 'The Zero-Leakage Contract audit could not be completed.');
      } catch (err) {
        console.error(err);
        setLoadError('Could not load diagnostic results.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [scope.storeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 border-2 border-cobalt-light border-t-transparent rounded-full animate-spin shadow-cobalt-glow" />
        <p className="text-xs font-mono text-slate-400">Loading forecast reliability diagnostics...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200">{loadError || 'Reliability diagnostics are unavailable.'}</div>;
  }

  const storeCoverageData = (data.prediction_intervals.store_coverage_details || []).map((s) => ({
    store: `S${s.store}`,
    storeNum: s.store,
    coverage: s.coverage,
    legacy: s.legacy_coverage,
  }));
  const activeWorkflow = data.prediction_intervals.workflows[0];
  const undercoveredStores = data.prediction_intervals.undercovered_stores || [];

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200" role="alert">
          {loadError}
        </div>
      )}
      <BentoCard
        title="Zero-Leakage Contract Audit"
        subtitle={`Runtime checks over the active dataset and the actual feature-generation pipeline · ${scope.storeId == null ? 'All stores' : `Store ${scope.storeId}`}`}
        badge={<StatusPill status={audit ? `${audit.passed}/${audit.total} PASSED` : 'AUDIT UNAVAILABLE'} size="sm" />}
      >
        {audit ? (
          <div className="space-y-3 text-xs">
            <p className="text-slate-300">
              Train: {audit.training.start_date || 'N/A'} – {audit.training.end_date || 'N/A'} ({audit.training.records.toLocaleString()} records) · Test: {audit.test.start_date || 'N/A'} – {audit.test.end_date || 'N/A'} ({audit.test.records.toLocaleString()} records)
            </p>
            <p className={audit.failed ? 'text-amber-300' : 'text-acid-light'}>
              {audit.passed} checks passed; {audit.failed} failed. Failed checks are surfaced, not counted as a success rate.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {audit.checks.map((check) => (
                <div key={check.name} className="rounded-lg border border-white/[0.06] bg-midnight-900/50 p-3">
                  <div className={`flex items-center gap-2 font-semibold ${check.passed ? 'text-acid-light' : 'text-rose-300'}`}>
                    {check.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {check.name}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{check.details}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 break-words">Features checked: {audit.features.join(', ')}</p>
          </div>
        ) : <p className="text-xs text-slate-400">Audit result unavailable; inspect the backend error and retry.</p>}
      </BentoCard>

      {/* Top Section: Prediction Interval Coverage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Active Holdout Coverage"
          value={activeWorkflow ? `${activeWorkflow.overall_coverage.toFixed(2)}%` : 'Unavailable'}
          subtitle={activeWorkflow ? `Mean interval width: $${activeWorkflow.mean_width_usd.toLocaleString()} · ${activeWorkflow.evaluated_records || 0} test rows` : data.prediction_intervals.interpretation}
          accent="acid"
        />

        <MetricCard
          title="Calibration Method"
          value={activeWorkflow?.workflow || 'Not calibrated'}
          subtitle={activeWorkflow ? `Calibrated on ${activeWorkflow.calibration_records || 0} earlier observations` : 'Insufficient history for a valid interval'}
          accent="cobalt"
        />

        <MetricCard
          title="Undercovered Stores"
          value={activeWorkflow ? `${undercoveredStores.length} / ${storeCoverageData.length} Stores` : 'Unavailable'}
          subtitle={activeWorkflow ? (undercoveredStores.length ? `Below nominal coverage: ${undercoveredStores.join(', ')}` : 'No tested store fell below 90% nominal') : 'No valid holdout calibration available'}
          accent="acid"
        />
      </div>

      {/* Store-level empirical coverage */}
      <BentoCard
        title="Active Dataset Holdout Coverage vs Nominal 90% Target"
        subtitle="Store-level results from the runtime chronological calibration and holdout evaluation"
        headerAction={
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cobalt-light inline-block" /> {activeWorkflow ? `Observed (${activeWorkflow.overall_coverage.toFixed(1)}%)` : 'No evaluation'}
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Below 90%
            </span>
          </div>
        }
      >
        <div className="h-64 w-full pt-2">
          {storeCoverageData.length ? <ResponsiveContainer width="100%" height="100%">
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
                    fill={entry.coverage < 90 ? '#F43F5E' : '#3B82F6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer> : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
              {data.prediction_intervals.interpretation}
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 text-center">
          {data.prediction_intervals.interpretation}
        </p>
      </BentoCard>

      {/* Feature Ablation & Warning Utility (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ablation Analysis Card */}
        <BentoCard
          title="Controlled Feature Ablation Analysis"
          subtitle="Active dataset's chronological holdout comparison; annual lag features removed"
        >
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-2.5">Model</th>
                    <th className="py-2 px-2.5 text-right">Holdout MAE &Delta;</th>
                    <th className="py-2 px-2.5 text-right">Full Feature MAE</th>
                    <th className="py-2 px-2.5 text-right">Evaluated Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {!data.feature_ablation.models.length && (
                    <tr><td colSpan={4} className="px-2.5 py-5 text-center text-slate-400">{data.feature_ablation.key_insight}</td></tr>
                  )}
                  {data.feature_ablation.models.map((m) => (
                    <tr key={m.model} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2.5 font-bold text-white">{m.model}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-rose-400">{m.all_fold_mae_change_pct > 0 ? '+' : ''}{m.all_fold_mae_change_pct.toFixed(1)}%</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-300">{m.full_feature_mae != null ? `$${m.full_feature_mae.toLocaleString()}` : '—'}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-acid-light font-bold">{m.evaluated_records || '—'}</td>
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
                  {!data.warning_utility.rules.length && (
                    <tr><td colSpan={5} className="px-2.5 py-5 text-center text-slate-400">{data.warning_utility.trade_off_explanation}</td></tr>
                  )}
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
