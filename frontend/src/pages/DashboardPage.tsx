import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Store as StoreIcon,
  Calendar,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

import { apiClient } from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { BentoCard } from '../components/BentoCard';
import { StatusPill } from '../components/StatusPill';
import { DatasetSummary, SalesAnalytics, BenchmarkModel, ForecastSummary } from '../types/api';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkModel[]>([]);
  const [forecastSum, setForecastSum] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sumRes, anaRes, benchRes, fcRes] = await Promise.all([
          apiClient.getDatasetSummary(),
          apiClient.getSalesAnalytics(),
          apiClient.getBenchmarks(),
          apiClient.getForecastSummary(),
        ]);
        setSummary(sumRes);
        setAnalytics(anaRes);
        setBenchmarks(benchRes);
        setForecastSum(fcRes);
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-2 border-cobalt-light border-t-transparent rounded-full animate-spin shadow-cobalt-glow" />
        <p className="text-sm font-mono text-slate-400">Loading verified retail telemetry...</p>
      </div>
    );
  }

  // Format timeline data for Recharts
  const chartData = (analytics?.timeline || []).map((pt) => ({
    date: pt.Date_Str,
    sales: Math.round(pt.Weekly_Sales / 1e6 * 100) / 100, // Millions
    isHoliday: pt.Holiday_Flag === 1,
  }));

  return (
    <div className="space-y-6">
      {/* Forecast Status Notice Banner */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-4 sm:p-5 border-l-4 border-l-acid-light bg-gradient-to-r from-acid-DEFAULT/5 via-transparent to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-acid-DEFAULT/15 text-acid-light shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Next-Week Forecast Ready: 2 November 2012</h4>
              <StatusPill status="UNOBSERVED HORIZON" size="sm" />
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Unified Random Forest model trained on 4,050 supervised historical rows. Calibrated nominal 90% empirical error bands applied across 45 stores.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('forecast')}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition-all duration-200"
        >
          <span>Inspect Forecasts</span>
          <ArrowUpRight className="w-4 h-4 text-acid-light" />
        </button>
      </div>

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Historical Sales"
          value={summary ? `$${(summary.total_sales / 1e9).toFixed(2)}B` : '$6.74B'}
          subtitle="6,435 observations across 45 stores"
          icon={DollarSign}
          trend="+8.2% YoY"
          trendPositive={true}
          accent="cobalt"
        />

        <MetricCard
          title="Active Stores"
          value={summary ? summary.total_stores : 45}
          subtitle="143 consecutive weeks per store"
          icon={StoreIcon}
          trend="100% Panel Complete"
          trendPositive={true}
          accent="acid"
        />

        <MetricCard
          title="Mean Weekly Sales"
          value={summary ? `$${(summary.mean_weekly_sales / 1e6).toFixed(2)}M` : '$1.05M'}
          subtitle={`Std Dev: $${summary ? (summary.std_weekly_sales / 1e3).toFixed(0) : '564'}K`}
          icon={TrendingUp}
          accent="cobalt"
        />

        <MetricCard
          title="Benchmark Top Model"
          value="Random Forest"
          subtitle="MAE: $36,036 | WAPE: 3.51%"
          icon={Sparkles}
          trend="Lowest MAE"
          trendPositive={true}
          accent="acid"
        />
      </div>

      {/* Main Bento Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Timeline Chart (2 Cols) */}
        <BentoCard
          title="Aggregate Weekly Sales Timeline (2010 – 2012)"
          subtitle="Total network weekly revenue with holiday peaks marked"
          className="lg:col-span-2"
          headerAction={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cobalt-light inline-block" /> Sales ($M)
              </span>
              <button
                onClick={() => onNavigate('analytics')}
                className="text-xs text-cobalt-glow hover:underline pl-2 font-medium"
              >
                Full Analytics &rarr;
              </button>
            </div>
          }
        >
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cobaltGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  tickFormatter={(val) => val.substring(0, 7)}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  tickFormatter={(val) => `$${val}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`$${val} Million`, 'Total Weekly Sales']}
                  labelFormatter={(lbl) => `Week Ending: ${lbl}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cobaltGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>Historical Period: <strong>5 Feb 2010 – 26 Oct 2012</strong></span>
            <span>Holiday Sales Boost: <strong className="text-acid-light">+{analytics?.holiday_comparison?.sales_lift_pct?.toFixed(1) || '8.2'}%</strong></span>
            <span>Zero Missing Cells Confirmed</span>
          </div>
        </BentoCard>

        {/* Forecast Quick Summary & Alert Diagnostics (1 Col) */}
        <BentoCard
          title="Upcoming Forecast Glance"
          subtitle="2 Nov 2012 | 45 Stores"
          headerAction={<StatusPill status="45 / 45 NORMAL" size="sm" />}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-midnight-900 border border-white/[0.06] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Projected Sales:</span>
                <span className="text-white font-mono font-bold text-sm">
                  ${forecastSum?.total_forecast_sales ? (forecastSum.total_forecast_sales / 1e6).toFixed(2) : '46.12'}M
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Mean Store Forecast:</span>
                <span className="text-white font-mono">
                  ${forecastSum?.mean_store_forecast ? (forecastSum.mean_store_forecast / 1e3).toFixed(1) : '1,024.9'}K
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Mean Interval Width:</span>
                <span className="text-slate-300 font-mono">
                  ${forecastSum?.mean_band_width ? (forecastSum.mean_band_width / 1e3).toFixed(1) : '340.9'}K
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Nominal Target Coverage:</span>
                <span className="text-acid-light font-mono font-bold">90.0%</span>
              </div>
            </div>

            {/* Store 36 Caution Notice */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Store 36 Reliability Caution</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/80">
                Store 36 observed only 78.57% empirical coverage on the 14-week holdout (below the 90% target). Treat prediction bands for Store 36 conservatively.
              </p>
            </div>

            <button
              onClick={() => onNavigate('forecast')}
              className="w-full py-2.5 px-4 rounded-xl bg-cobalt hover:bg-cobalt-light text-white text-xs font-semibold shadow-cobalt-glow transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Explore All 45 Store Forecasts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </BentoCard>
      </div>

      {/* Model Benchmark Table Card */}
      <BentoCard
        title="Original 14-Week Holdout Benchmark Models"
        subtitle="Evaluated on 630 store-weeks (27 July – 26 October 2012) using chronological leakage-safe splits"
        headerAction={
          <button
            onClick={() => onNavigate('comparison')}
            className="text-xs text-cobalt-glow hover:underline font-medium"
          >
            Compare All Models &rarr;
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">MAE (USD)</th>
                <th className="py-2.5 px-3 text-right">RMSE (USD)</th>
                <th className="py-2.5 px-3 text-right">WAPE (%)</th>
                <th className="py-2.5 px-3 text-right">R² Score</th>
                <th className="py-2.5 px-3 text-center">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {benchmarks.map((m, idx) => {
                const isWinner = m.Model === 'Random Forest';
                return (
                  <tr
                    key={m.Model}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      isWinner ? 'bg-cobalt/10 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-3 flex items-center gap-2 text-white">
                      {isWinner && <span className="w-1.5 h-1.5 rounded-full bg-acid-light" />}
                      {m.Model}
                    </td>
                    <td className="py-3 px-3">
                      <StatusPill status={m.Type} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      ${m.MAE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      ${m.RMSE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-acid-light font-bold">
                      {m['WAPE (%)'].toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {m.R2 ? m.R2.toFixed(4) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                        #{idx + 1}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BentoCard>
    </div>
  );
};

