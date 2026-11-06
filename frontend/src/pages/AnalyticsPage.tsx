import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Calendar,
  Filter,
  DollarSign,
  Percent,
  Sparkles,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';

import { apiClient } from '../api/client';
import { BentoCard } from '../components/BentoCard';
import { MetricCard } from '../components/MetricCard';
import { SalesAnalytics, StoreRanking } from '../types/api';
import { useForecastScope } from '../state/ForecastScopeContext';

export const AnalyticsPage: React.FC = () => {
  const { scope, setScope } = useForecastScope();
  const selectedStore = scope.storeId;
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [rankings, setRankings] = useState<{ all_stores: StoreRanking[]; top_stores: StoreRanking[]; bottom_stores: StoreRanking[] } | null>(null);
  const [storeIds, setStoreIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setAnalytics(null);
        setRankings(null);
        setLoadError(null);
        const [anaRes, rankRes, dataset] = await Promise.all([
          apiClient.getSalesAnalytics(selectedStore),
          apiClient.getStoreRankings(),
          apiClient.getDatasetSummary(),
        ]);
        setAnalytics(anaRes);
        setRankings(rankRes);
        setStoreIds(dataset.store_ids);
        setLoadError(null);
      } catch (err) {
        console.error(err);
        const detail = (err as any)?.response?.data?.detail;
        setLoadError(typeof detail === 'string' ? detail : 'Sales analytics could not be loaded for the active dataset.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStore]);

  if (loading && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 border-2 border-cobalt-light border-t-transparent rounded-full animate-spin shadow-cobalt-glow" />
        <p className="text-xs font-mono text-slate-400">Aggregating historical store analytics...</p>
      </div>
    );
  }

  const timelineData = (analytics?.timeline || []).map((pt) => ({
    date: pt.Date_Str,
    sales: Math.round(pt.Weekly_Sales / 1e3), // Thousands
    isHoliday: pt.Holiday_Flag === 1,
  }));

  const monthlyData = analytics?.monthly_seasonality || [];

  return (
    <div className="space-y-6">
      {/* Filters and Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-white/[0.08]">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cobalt-glow" />
            Retail Sales Performance & Seasonality Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Slicing historical behavior across {analytics?.timeline.length || 0} observed weekly dates
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-400">Store Filter:</span>
          <select
            value={selectedStore === null ? '' : selectedStore}
            onChange={(e) => setScope((current) => ({
              ...current,
              storeId: e.target.value ? Number(e.target.value) : null,
              lastForecast: null,
            }))}
            className="bg-midnight-900 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="">Aggregate All Stores ({storeIds.length})</option>
            {storeIds.map((s) => (
              <option key={s} value={s}>Store {s}</option>
            ))}
          </select>
        </div>
      </div>
      {loadError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200" role="alert">
          {loadError}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Holiday Mean Weekly Sales"
          value={analytics?.holiday_comparison?.Holiday ? `$${(analytics.holiday_comparison.Holiday.mean / 1e6).toFixed(2)}M` : 'Unavailable'}
          subtitle="Observed during promotional holiday periods"
          icon={Calendar}
          accent="acid"
        />

        <MetricCard
          title="Regular Mean Weekly Sales"
          value={analytics?.holiday_comparison?.['Non-Holiday'] ? `$${(analytics.holiday_comparison['Non-Holiday'].mean / 1e6).toFixed(2)}M` : 'Unavailable'}
          subtitle="Observed during standard trading weeks"
          icon={DollarSign}
          accent="cobalt"
        />

        <MetricCard
          title="Holiday Sales Lift"
          value={analytics?.holiday_comparison.sales_lift_pct == null ? 'Unavailable' : `${analytics.holiday_comparison.sales_lift_pct.toFixed(2)}%`}
          subtitle="Net revenue uplift from holiday demand spikes"
          icon={Percent}
          trendPositive={analytics?.holiday_comparison.sales_lift_pct != null && analytics.holiday_comparison.sales_lift_pct >= 0}
          accent="acid"
        />
      </div>

      {/* Time-Series Trend Chart */}
      <BentoCard
        title={selectedStore ? `Store ${selectedStore}: Weekly Sales Timeline` : "Network Weekly Sales Revenue (USD Thousands)"}
        subtitle={analytics?.timeline.length ? `${analytics.timeline[0].Date_Str} to ${analytics.timeline[analytics.timeline.length - 1].Date_Str}` : 'No historical sales are available for this scope'}
      >
        <div className="h-72 w-full pt-2">
          {timelineData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Historical sales are unavailable for the selected dataset and store scope.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748B', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
                tickFormatter={(val) => val.substring(0, 7)}
                minTickGap={35}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1E293B' }}
                tickFormatter={(val) => `$${val.toLocaleString()}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`$${val.toLocaleString()} Thousand`, 'Weekly Sales']}
                labelFormatter={(lbl) => `Week Ending: ${lbl}`}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#salesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>
      </BentoCard>

      {/* Monthly Seasonality & Store Rankings (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Seasonality */}
        <BentoCard
          title="Monthly Seasonality Profile"
          subtitle="Average historical weekly sales by calendar month"
        >
          <div className="h-64 w-full pt-2">
            {monthlyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Seasonality is unavailable for the selected dataset scope.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1E293B' }} />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                  tickFormatter={(val) => `$${(val / 1e6).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Avg Sales']}
                />
                <Bar dataKey="avg_sales" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.month === 'Dec' || entry.month === 'Nov' ? '#A3E635' : '#3B82F6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </BentoCard>

        {/* Top 5 & Bottom 5 Store Rankings */}
        <BentoCard
          title="Top Performing Stores by Revenue"
          subtitle="Stores ranked by observed cumulative sales in the active dataset"
        >
          <div className="space-y-3">
            {(rankings?.top_stores || []).map((s, idx) => (
              <div key={s.Store} className="p-2.5 rounded-xl bg-midnight-900 border border-white/[0.05] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cobalt/20 text-cobalt-glow border border-cobalt/40 flex items-center justify-center font-mono font-bold text-[10px]">
                    #{idx + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-white">Store {s.Store}</h5>
                    <p className="text-[10px] text-slate-400">Avg: ${(s.Avg_Weekly_Sales / 1e6).toFixed(2)}M / week</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-acid-light font-bold text-sm">
                    ${(s.Total_Sales / 1e6).toFixed(1)}M
                  </span>
                  <p className="text-[10px] text-slate-400">Total Revenue</p>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
};
