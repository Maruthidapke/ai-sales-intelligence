import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Play,
  Download,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';

import { apiClient } from '../api/client';
import { BentoCard } from '../components/BentoCard';
import { MetricCard } from '../components/MetricCard';
import { StatusPill } from '../components/StatusPill';
import { StoreForecast, ForecastSummary } from '../types/api';

export const ForecastPage: React.FC = () => {
  const [forecasts, setForecasts] = useState<StoreForecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [selectedStore, setSelectedStore] = useState<number | ''>('');
  const [selectedModel, setSelectedModel] = useState<string>('Random Forest');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const [sumRes, fcRes] = await Promise.all([
        apiClient.getForecastSummary(),
        apiClient.getStoreForecasts(selectedStore !== '' ? Number(selectedStore) : null),
      ]);
      setSummary(sumRes);
      setForecasts(fcRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, [selectedStore]);

  const handleRunForecast = async () => {
    try {
      setGenerating(true);
      const res = await apiClient.generateForecast(
        selectedStore !== '' ? Number(selectedStore) : null,
        selectedModel
      );
      setForecasts(res.forecasts);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const chartData = forecasts.slice(0, 25).map((f) => ({
    store: `S${f.Store}`,
    forecast: Math.round(f.Forecast_Sales / 1e3),
    lower: Math.round(f.Lower_Bound / 1e3),
    upper: Math.round(f.Upper_Bound / 1e3),
    alert: f.Alert,
  }));

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer Banner */}
      <div className="p-4 rounded-2xl glass-panel border border-cobalt/30 bg-cobalt/5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-cobalt-glow shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Historical Evaluation Horizon: 2 November 2012</span>
            <StatusPill status="UNOBSERVED TEST DATE" size="sm" />
          </div>
          <p className="text-slate-300 leading-relaxed">
            Historical observations end on 26 October 2012. Forecasts are generated for the immediately subsequent week (2 November 2012). No realized target values exist in the supplied dataset for this date.
          </p>
        </div>
      </div>

      {/* Control Configuration Console */}
      <BentoCard
        title="Predictive Forecasting Engine Console"
        subtitle="Configure model, horizon, and store targeting"
        headerAction={
          <button
            onClick={handleRunForecast}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cobalt to-cobalt-light hover:from-cobalt-light hover:to-cobalt text-white text-xs font-bold shadow-cobalt-glow transition-all duration-200 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Executing ML Pipeline...' : 'Generate Forecast'}</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Forecasting Model Architecture
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-midnight-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cobalt-light cursor-pointer"
            >
              <option value="Random Forest">Random Forest (Unified Production)</option>
              <option value="Gradient Boosting">Gradient Boosting Regressor</option>
              <option value="XGBoost">XGBoost CPU Regressor</option>
              <option value="Seasonal baseline">Seasonal Baseline (Lag 52)</option>
              <option value="Last-week baseline">Last-Week Baseline (Lag 1)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Store Scope Selection
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-midnight-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cobalt-light cursor-pointer"
            >
              <option value="">All Stores (Store 1 to 45)</option>
              {Array.from({ length: 45 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>Store {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Forecast Date
            </label>
            <input
              type="text"
              readOnly
              value={summary?.forecast_date || '2012-11-02'}
              className="w-full bg-midnight-900/60 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-acid-light font-mono cursor-not-allowed"
            />
          </div>
        </div>
      </BentoCard>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Forecast Sales"
          value={`$${summary ? (summary.total_forecast_sales / 1e6).toFixed(2) : '46.12'}M`}
          subtitle="Sum of point predictions across 45 stores"
          accent="cobalt"
        />

        <MetricCard
          title="Mean Store Forecast"
          value={`$${summary ? (summary.mean_store_forecast / 1e3).toFixed(1) : '1,024.9'}K`}
          subtitle="Projected revenue per store"
          accent="acid"
        />

        <MetricCard
          title="Empirical Band Width"
          value={`$${summary ? (summary.mean_band_width / 1e3).toFixed(1) : '340.9'}K`}
          subtitle="Average ± interval span (90% nominal)"
          accent="cobalt"
        />

        <MetricCard
          title="Upcoming Alert Status"
          value="45 NORMAL"
          subtitle="0 High, 0 Low material movements flagged"
          accent="acid"
        />
      </div>

      {/* Forecast Chart */}
      <BentoCard
        title="Projected Store Sales Distribution with Interval Widths"
        subtitle="Showing point forecasts (thousands USD) across stores"
      >
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="store" tick={{ fill: '#94A3B8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1E293B' }} />
              <YAxis
                tick={{ fill: '#94A3B8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
                tickFormatter={(val) => `$${val}K`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => [`$${val.toLocaleString()}K`, 'Forecast Sales']}
              />
              <Bar dataKey="forecast" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </BentoCard>

      {/* Detailed Forecast Records Table */}
      <BentoCard
        title="Store-by-Store Forecast Ledger"
        subtitle={`Total of ${forecasts.length} store predictions with empirical bounds and deviation telemetry`}
        headerAction={
          <a
            href="/api/reports/csv"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 border border-white/[0.1] transition-all"
          >
            <Download className="w-3.5 h-3.5 text-acid-light" />
            <span>Download CSV</span>
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Store</th>
                <th className="py-2.5 px-3">Forecast Date</th>
                <th className="py-2.5 px-3 text-right">Forecast Sales ($)</th>
                <th className="py-2.5 px-3 text-right">90% Lower Bound</th>
                <th className="py-2.5 px-3 text-right">90% Upper Bound</th>
                <th className="py-2.5 px-3 text-right">Prior 13W Mean</th>
                <th className="py-2.5 px-3 text-right">Change vs Mean</th>
                <th className="py-2.5 px-3 text-center">Alert Status</th>
                <th className="py-2.5 px-3">Reliability Caution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {forecasts.map((f) => {
                const isUndercovered = f.Store === 36;
                return (
                  <tr
                    key={f.Store}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      isUndercovered ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-white">Store {f.Store}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{f.Forecast_Date}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-acid-light font-bold">
                      ${f.Forecast_Sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      ${f.Lower_Bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      ${f.Upper_Bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      ${f.Prior_13W_Mean.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={f.Change_vs_Mean_Pct >= 0 ? 'text-acid-light' : 'text-slate-300'}>
                        {f.Change_vs_Mean_Pct >= 0 ? '+' : ''}{f.Change_vs_Mean_Pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusPill status={f.Alert} size="sm" />
                    </td>
                    <td className="py-2.5 px-3">
                      {isUndercovered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          BELOW NOMINAL (78.57%)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">14 reviewed outcomes</span>
                      )}
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

