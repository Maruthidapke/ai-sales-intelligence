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
import { BenchmarkModel, BacktestModel } from '../types/api';

export const ComparisonPage: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkModel[]>([]);
  const [backtests, setBacktests] = useState<BacktestModel[]>([]);
  const [stability, setStability] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [benchRes, backRes, stabRes] = await Promise.all([
          apiClient.getBenchmarks(),
          apiClient.getNestedBacktests(),
          apiClient.getStabilityData(),
        ]);
        setBenchmarks(benchRes);
        setBacktests(backRes);
        setStability(stabRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = benchmarks.map((b) => ({
    name: b.Model.replace(' baseline', ''),
    MAE: Math.round(b.MAE),
    RMSE: Math.round(b.RMSE),
    WAPE: Number(b['WAPE (%)'].toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Critical Methodology Insight Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-acid-DEFAULT/30 bg-acid-DEFAULT/5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-acid-light shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-white text-sm">Key Retail Forecasting Finding</h4>
          <p className="text-slate-300 leading-relaxed">
            Machine Learning algorithms do <strong>not</strong> universally outperform simpler baselines. While Random Forest achieves the lowest MAE ($36,036) on the 14-week holdout, the <strong>Seasonal Baseline (Lag 52) wins the 4-period nested backtest</strong> (Pooled MAE $61,207 vs RF $69,422).
          </p>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Holdout MAE Winner"
          value="Random Forest"
          subtitle="$36,036.48 (WAPE: 3.51%)"
          icon={Award}
          accent="acid"
        />

        <MetricCard
          title="Holdout RMSE Winner"
          value="Gradient Boosting"
          subtitle="$53,824.53 (Lower penalty on outliers)"
          icon={BarChart2}
          accent="cobalt"
        />

        <MetricCard
          title="Nested Backtest Winner"
          value="Seasonal Baseline"
          subtitle="Pooled MAE: $61,207.48 (WAPE: 5.74%)"
          icon={Scale}
          accent="acid"
        />
      </div>

      {/* Benchmark Metric Comparison Chart */}
      <BentoCard
        title="Original 14-Week Holdout Benchmark Comparison"
        subtitle="Comparing MAE and RMSE error in USD across all 5 algorithms"
      >
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </div>
      </BentoCard>

      {/* Two Comparison Bento Tables: Benchmark vs Nested Backtest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Original Benchmark */}
        <BentoCard
          title="1. Original Benchmark (14-Week Holdout)"
          subtitle="630 store-weeks (27 July – 26 October 2012)"
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
                      {m.R2 ? m.R2.toFixed(4) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>

        {/* Table 2: 4-Period Nested Backtest */}
        <BentoCard
          title="2. Four-Period Nested Backtesting"
          subtitle="2,295 store-weeks (5 Aug 2011 – 20 Jul 2012)"
          badge={<StatusPill status="SEASONAL WINS" size="sm" />}
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
                  const isWinner = b.Model === 'Seasonal baseline';
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
        subtitle="Evaluating week-by-week differences and 3-week block bootstrap confidence interval"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-midnight-900 border border-white/[0.06] text-xs">
          <div>
            <span className="text-slate-400">Mean MAE Gap:</span>
            <p className="font-mono text-white text-base font-bold mt-1">
              ${stability?.mean_mae_difference_usd ? stability.mean_mae_difference_usd.toFixed(2) : '131.26'}
            </p>
            <p className="text-[10px] text-slate-500">Virtually identical aggregate error</p>
          </div>

          <div>
            <span className="text-slate-400">Weekly Head-to-Head:</span>
            <p className="font-mono text-acid-light text-base font-bold mt-1">
              {stability?.rf_week_wins || 7} vs {stability?.gb_week_wins || 7} Wins
            </p>
            <p className="text-[10px] text-slate-500">Each algorithm won 50% of the weeks</p>
          </div>

          <div className="md:col-span-2">
            <span className="text-slate-400">3-Week Block Bootstrap 95% Confidence Interval:</span>
            <p className="font-mono text-cobalt-glow text-base font-bold mt-1">
              [${stability?.bootstrap_3week_block_95_ci?.[0]?.toFixed(2) || '-3,196.05'}, +${stability?.bootstrap_3week_block_95_ci?.[1]?.toFixed(2) || '2,616.22'}]
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Contains zero. No statistically significant claim of universal superiority can be made between Random Forest and Gradient Boosting.
            </p>
          </div>
        </div>
      </BentoCard>
    </div>
  );
};

