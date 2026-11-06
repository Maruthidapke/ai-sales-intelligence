import React, { useEffect, useState } from 'react';
import {
  Scale,
  Award,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

import { apiClient } from '../api/client';
import { BentoCard } from '../components/BentoCard';
import { MetricCard } from '../components/MetricCard';
import { StatusPill } from '../components/StatusPill';
import { BenchmarkModel, BacktestModel, ModelStability } from '../types/api';
import { useForecastScope } from '../state/ForecastScopeContext';

export const ComparisonPage: React.FC = () => {
  const { scope, setScope } = useForecastScope();
  const selectedStore = scope.storeId;
  const [benchmarks, setBenchmarks] = useState<BenchmarkModel[]>([]);
  const [backtests, setBacktests] = useState<BacktestModel[]>([]);
  const [stability, setStability] = useState<ModelStability | null>(null);
  const [storeIds, setStoreIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setBenchmarks([]);
        setBacktests([]);
        setStability(null);
        const [benchRes, backRes, stabRes, dataset] = await Promise.allSettled([
          apiClient.getBenchmarks(selectedStore),
          apiClient.getNestedBacktests(selectedStore),
          apiClient.getStabilityData(selectedStore),
          apiClient.getDatasetSummary(),
        ]);
        const errors: string[] = [];
        if (benchRes.status === 'fulfilled') setBenchmarks(benchRes.value);
        else errors.push((benchRes.reason as any)?.response?.data?.detail || 'Benchmark comparison is unavailable.');
        if (backRes.status === 'fulfilled') setBacktests(backRes.value);
        else errors.push((backRes.reason as any)?.response?.data?.detail || 'Chronological backtests are unavailable.');
        if (stabRes.status === 'fulfilled') setStability(stabRes.value);
        else errors.push((stabRes.reason as any)?.response?.data?.detail || 'Paired stability analysis is unavailable.');
        if (dataset.status === 'fulfilled') setStoreIds(dataset.value.store_ids);
        setErrorMessage(errors.length ? [...new Set(errors)].join(' ') : null);
      } catch (err) {
        console.error(err);
        const detail = (err as any)?.response?.data?.detail;
        setErrorMessage(typeof detail === 'string' ? detail : 'Model comparisons could not be calculated for the active dataset.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStore]);

  const chartData = benchmarks.filter((b) => Number.isFinite(b.MAE) && Number.isFinite(b.RMSE)).map((b) => ({
    name: b.Model.replace(' baseline', ''),
    MAE: Math.round(b.MAE),
    RMSE: Math.round(b.RMSE),
    WAPE: Number(b['WAPE (%)'].toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/[0.08]">
        <div>
          <h2 className="text-sm font-bold text-white">Evaluation Scope</h2>
          <p className="text-xs text-slate-400 mt-0.5">Metrics are recomputed from the active dataset and selected store.</p>
        </div>
        <select
          value={selectedStore ?? ''}
          onChange={(event) => setScope((current) => ({
            ...current,
            storeId: event.target.value ? Number(event.target.value) : null,
            lastForecast: null,
          }))}
          className="bg-midnight-900 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white"
        >
          <option value="">All Stores</option>
          {storeIds.map((storeId) => <option key={storeId} value={storeId}>Store {storeId}</option>)}
        </select>
      </div>
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200" role="alert">
          {errorMessage}
        </div>
      )}
      {/* Critical Methodology Insight Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-acid-DEFAULT/30 bg-acid-DEFAULT/5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-acid-light shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-white text-sm">Key Retail Forecasting Finding</h4>
          <p className="text-slate-300 leading-relaxed">
            Model rankings below are calculated from the active dataset using chronological holdout and expanding-window backtests. Lower errors indicate better performance on the evaluated periods; results do not guarantee future performance.
          </p>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Holdout MAE Winner"
          value={benchmarks[0]?.Model || 'Unavailable'}
          subtitle={benchmarks[0] ? `MAE: $${benchmarks[0].MAE.toLocaleString()} · WAPE: ${benchmarks[0]['WAPE (%)'].toFixed(2)}%` : 'No valid holdout metrics available'}
          icon={Award}
          accent="acid"
        />

        <MetricCard
          title="Holdout RMSE Winner"
          value={[...benchmarks].sort((a, b) => a.RMSE - b.RMSE)[0]?.Model || 'Unavailable'}
          subtitle={benchmarks.length ? `Lowest holdout RMSE: $${Math.min(...benchmarks.map((m) => m.RMSE)).toLocaleString()}` : 'No valid holdout metrics available'}
          icon={BarChart2}
          accent="cobalt"
        />

        <MetricCard
          title="Nested Backtest Winner"
          value={[...backtests].sort((a, b) => a['Pooled MAE (USD)'] - b['Pooled MAE (USD)'])[0]?.Model || 'Unavailable'}
          subtitle={backtests.length ? `Best expanding-window pooled MAE: $${Math.min(...backtests.map((m) => m['Pooled MAE (USD)'])).toLocaleString()}` : 'No valid chronological backtests available'}
          icon={Scale}
          accent="acid"
        />
      </div>

      {/* Benchmark Metric Comparison Chart */}
      <BentoCard
        title="Active Dataset Chronological Holdout Comparison"
        subtitle="Actual MAE and RMSE errors in USD across the models that are available"
      >
        <div className="h-72 w-full pt-2">
          {chartData.length ? <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1E293B' }} />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
                tickFormatter={(val) => `$${(val / 1e3).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => [`$${val.toLocaleString()}`, 'Error (USD)']}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
              <Bar dataKey="MAE" name="Mean Absolute Error (MAE)" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RMSE" name="Root Mean Squared Error (RMSE)" fill="#A3E635" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer> : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
              No valid holdout metrics are available for this dataset and scope. Longer weekly history is required after feature warm-up.
            </div>
          )}
        </div>
      </BentoCard>

      {/* Two Comparison Bento Tables: Benchmark vs Nested Backtest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Original Benchmark */}
        <BentoCard
          title="1. Original Benchmark (14-Week Holdout)"
          subtitle={`${benchmarks.reduce((total, model) => total + (model.Evaluated_Records || 0), 0).toLocaleString()} evaluated records · chronological holdout`}
          badge={<StatusPill status="HOLDOUT TEST" size="sm" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3 text-right">MAE (USD)</th>
                  <th className="py-2.5 px-3 text-right">RMSE (USD)</th>
                  <th className="py-2.5 px-3 text-right">WAPE (%)</th>
                  <th className="py-2.5 px-3 text-right">R²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {benchmarks.map((m) => (
                  <tr key={m.Model} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-semibold text-white">{m.Model}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      ${m.MAE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      ${m.RMSE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-acid-light font-bold">
                      {m['WAPE (%)'].toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {m.R2 != null && Number.isFinite(m.R2) ? m.R2.toFixed(4) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>

        {/* Table 2: 4-Period Nested Backtest */}
        <BentoCard
          title="Expanding-Window Chronological Backtesting"
          subtitle={`${backtests[0]?.Evaluated_Records?.toLocaleString() || '—'} pooled test records across ${backtests[0]?.Folds?.length || 0} windows`}
          badge={<StatusPill status={backtests[0]?.Model || 'NO BACKTEST'} size="sm" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3 text-right">Pooled MAE</th>
                  <th className="py-2.5 px-3 text-right">Pooled RMSE</th>
                  <th className="py-2.5 px-3 text-right">WAPE (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {backtests.map((b) => {
                  const isWinner = b.Model === backtests[0]?.Model;
                  return (
                    <tr key={b.Model} className={`hover:bg-white/[0.02] ${isWinner ? 'bg-acid-DEFAULT/10' : ''}`}>
                      <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
                        {isWinner && <Award className="w-3.5 h-3.5 text-acid-light" />}
                        {b.Model}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        ${b['Pooled MAE (USD)'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        ${b['Pooled RMSE (USD)'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-acid-light font-bold">
                        {b['WAPE (%)'].toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>

      {/* Paired Stability Card */}
      <BentoCard
        title="Random Forest vs Gradient Boosting Paired Stability Analysis"
        subtitle="Same expanding chronological folds for both models; metrics and intervals are computed from this active scope"
      >
        {stability ? <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-midnight-900 border border-white/[0.06] text-xs">
          <div>
            <span className="text-slate-400">Mean MAE Gap:</span>
            <p className="font-mono text-white text-base font-bold mt-1">
              ${stability.mean_mae_difference_usd.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500">RF minus GB average fold MAE · SD ${stability.mae_difference_std_usd.toFixed(2)}</p>
          </div>

          <div>
            <span className="text-slate-400">Weekly Head-to-Head:</span>
            <p className="font-mono text-acid-light text-base font-bold mt-1">
              {stability.rf_week_wins} vs {stability.gb_week_wins} Fold Wins
            </p>
            <p className="text-[10px] text-slate-500">{stability.evaluated_folds} paired folds · {stability.total_test_weeks} test dates</p>
          </div>

          <div className="md:col-span-2">
            <span className="text-slate-400">2-Fold Block Bootstrap 95% Confidence Interval:</span>
            <p className="font-mono text-cobalt-glow text-base font-bold mt-1">
              [${stability.bootstrap_2fold_block_95_ci[0].toLocaleString()}, ${stability.bootstrap_2fold_block_95_ci[1].toLocaleString()}]
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {stability?.conclusion || 'No paired inference is available for this dataset.'}
            </p>
          </div>
        </div> : (
          <p className="p-4 rounded-xl bg-midnight-900 border border-white/[0.06] text-xs text-slate-400">
            Paired stability results are unavailable. The backend error above contains the active-data history requirement.
          </p>
        )}
        {stability && (
          <div className="mt-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stability.folds} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="fold" tickFormatter={(fold) => `Fold ${fold}`} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Fold MAE']}
                  />
                  <Legend />
                  <Bar dataKey="Random Forest_mae_usd" name="Random Forest MAE" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Gradient Boosting_mae_usd" name="Gradient Boosting MAE" fill="#A3E635" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-2">Fold / Test Dates</th>
                    <th className="py-2 px-2 text-right">RF MAE / RMSE / WAPE</th>
                    <th className="py-2 px-2 text-right">GB MAE / RMSE / WAPE</th>
                    <th className="py-2 px-2 text-right">RF / GB Error SD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {stability.folds.map((fold) => (
                    <tr key={fold.fold}>
                      <td className="py-2 px-2 text-slate-300">Fold {fold.fold} · {fold.test_start} – {fold.test_end}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-200">
                        ${Number(fold['Random Forest_mae_usd']).toFixed(0)} / ${Number(fold['Random Forest_rmse_usd']).toFixed(0)} / {Number(fold['Random Forest_wape_pct']).toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-200">
                        ${Number(fold['Gradient Boosting_mae_usd']).toFixed(0)} / ${Number(fold['Gradient Boosting_rmse_usd']).toFixed(0)} / {Number(fold['Gradient Boosting_wape_pct']).toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-300">
                        ${Number(fold['Random Forest_error_std_usd']).toFixed(0)} / ${Number(fold['Gradient Boosting_error_std_usd']).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </BentoCard>
    </div>
  );
};
