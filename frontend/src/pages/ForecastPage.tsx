import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Play,
  Download,
  AlertTriangle,
  CheckCircle,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ErrorBar,
  LineChart,
  Line,
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
import { StoreForecast, ForecastSummary, SalesTimelinePoint, ActualVsPredictedPoint } from '../types/api';
import { useForecastScope } from '../state/ForecastScopeContext';

const addDaysToIsoDate = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const ForecastPage: React.FC = () => {
  const { scope, setScope } = useForecastScope();
  const { storeId: selectedStore, modelName: selectedModel, forecastDate, dateMode } = scope;
  const [forecasts, setForecasts] = useState<StoreForecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<{ store_ids: number[]; max_date: string } | null>(null);
  const [salesTimeline, setSalesTimeline] = useState<SalesTimelinePoint[]>([]);
  const [actualVsPredicted, setActualVsPredicted] = useState<ActualVsPredictedPoint[]>([]);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [dateInfo, dataset] = await Promise.all([
        apiClient.getForecastTargetDate(dateMode),
        apiClient.getDatasetSummary(),
      ]);
      setToday(dateInfo.today);
      setScope((current) => ({ ...current, forecastDate: dateInfo.default_target_date, lastForecast: null }));
      setDatasetSummary({ store_ids: dataset.store_ids, max_date: dataset.max_date });
      setErrorMessage(null);
    } catch (err) {
      console.error(err);
      const detail = (err as any)?.response?.data?.detail;
      setErrorMessage(typeof detail === 'string' ? detail : 'Forecast summary is unavailable for this dataset. Select a supported baseline or run a model with sufficient history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, [dateMode, setScope]);

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        const history = await apiClient.getSalesAnalytics(selectedStore);
        if (active) {
          setSalesTimeline(history.timeline || []);
          setHistoryMessage(null);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setSalesTimeline([]);
          setHistoryMessage('Historical sales are unavailable for the selected store scope.');
        }
      }
    };
    fetchHistory();
    return () => {
      active = false;
    };
  }, [selectedStore]);

  const handleRunForecast = async (modelToRun = selectedModel) => {
    try {
      setGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await apiClient.generateForecast(
        selectedStore,
        modelToRun,
        forecastDate,
        dateMode,
      );
      if (!Array.isArray(res.forecasts) || res.forecasts.length === 0) {
        throw new Error('The forecast service returned no forecast records.');
      }
      setForecasts(res.forecasts as StoreForecast[]);
      setSummary(res.summary as ForecastSummary);
      setScope((current) => ({ ...current, lastForecast: res }));
      setActualVsPredicted([]);
      setHistoryMessage(null);
      try {
        setActualVsPredicted(await apiClient.getActualVsPredicted(
          selectedStore,
          modelToRun,
        ));
      } catch {
        setHistoryMessage('Actual-vs-predicted holdout history is not available for this dataset and model.');
      }
      setSuccessMessage(`${res.summary.model_used} generated ${res.forecasts.length} store forecast(s) for ${res.forecast_date} (${res.horizon_weeks}-week horizon).`);
    } catch (err) {
      console.error(err);
      const detail = (err as any)?.response?.data?.detail || (err as any)?.message;
      setErrorMessage(typeof detail === 'string' ? detail : 'Forecast generation failed. See the backend response for details.');
      setForecasts([]);
      setSummary(null);
      setActualVsPredicted([]);
      setScope((current) => ({ ...current, lastForecast: null }));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadForecastCsv = () => {
    if (!forecasts.length) return;
    try {
      const columns = Object.keys(forecasts[0]) as (keyof StoreForecast)[];
      const rows = [
        columns,
        ...forecasts.map((forecast) => columns.map((column) => forecast[column])),
      ];
      const csv = rows.map((row) => row.map((value) => {
        const text = value == null ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      }).join(',')).join('\r\n');
      const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `VORTEX_${summary?.model_used.replace(/[^A-Za-z0-9_-]+/g, '_') || 'Forecast'}_${summary?.forecast_date || 'results'}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Could not export the displayed forecast records.');
    }
  };

  const chartData = forecasts.slice(0, 25).map((f) => ({
    store: `S${f.Store}`,
    forecast: Math.round(f.Forecast_Sales / 1e3),
    lower: f.Lower_Bound == null ? null : Math.round(f.Lower_Bound / 1e3),
    upper: f.Upper_Bound == null ? null : Math.round(f.Upper_Bound / 1e3),
    interval: f.Lower_Bound == null || f.Upper_Bound == null
      ? null
      : [
        Math.max(0, (f.Forecast_Sales - f.Lower_Bound) / 1e3),
        Math.max(0, (f.Upper_Bound - f.Forecast_Sales) / 1e3),
      ],
    alert: f.Alert,
  }));
  const historicalPredictions = new Map(
    actualVsPredicted
      .filter((point) => point.Type === 'Historical' && Number.isFinite(point.Predicted))
      .map((point) => [point.Date, point.Predicted]),
  );
  const historyChartData: {
    date: string;
    actual: number | null;
    predicted: number | null;
    forecast: number | null;
  }[] = salesTimeline.map((point) => ({
    date: point.Date_Str,
    actual: point.Weekly_Sales,
    predicted: historicalPredictions.get(point.Date_Str) ?? null,
    forecast: null as number | null,
  }));
  if (summary && historyChartData.length) {
    const lastDate = historyChartData[historyChartData.length - 1].date;
    const futureDate = summary.forecast_date;
    if (futureDate !== lastDate) {
      const forecastTotal = selectedStore === null
        ? forecasts.reduce((total, point) => total + point.Forecast_Sales, 0)
        : forecasts[0]?.Forecast_Sales;
      if (forecastTotal != null && Number.isFinite(forecastTotal)) {
        historyChartData.push({ date: futureDate, actual: null, predicted: null, forecast: forecastTotal });
      }
    }
  }

  useEffect(() => {
    setForecasts([]);
    setSummary(null);
    setActualVsPredicted([]);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [selectedStore, selectedModel, forecastDate, dateMode]);

  const latestDate = datasetSummary?.max_date ? new Date(`${datasetSummary.max_date}T00:00:00Z`) : null;
  const todayDate = today ? new Date(`${today}T00:00:00Z`) : null;
  const targetDateValue = forecastDate ? new Date(`${forecastDate}T00:00:00Z`) : null;
  const forecastHorizon = latestDate && targetDateValue
    ? Math.round((targetDateValue.getTime() - latestDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;
  const forecastDateWarning = dateMode === 'future' && latestDate && todayDate && targetDateValue
    ? (forecastHorizon !== null && forecastHorizon > 52
      ? 'This dataset is too old for a supported future forecast horizon. Upload newer sales history or switch to Historical Next-Week Evaluation.'
      : targetDateValue <= todayDate
        ? 'Future Forecast mode requires a date after today. Choose a future weekly date or switch to Historical Next-Week Evaluation.'
        : null)
    : null;

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 rounded-xl border border-acid-DEFAULT/30 bg-acid-DEFAULT/10 text-xs text-acid-light flex items-center gap-2" role="status">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="space-y-2">
            <p>{errorMessage}</p>
            {selectedModel !== 'Last-week baseline' && /insufficient history|supervised records|54 weekly observations|at least 50/i.test(errorMessage) && (
              <button
                type="button"
                disabled={generating}
                onClick={() => {
                  setScope((current) => ({ ...current, modelName: 'Last-week baseline', lastForecast: null }));
                  void handleRunForecast('Last-week baseline');
                }}
                className="rounded-lg border border-acid-DEFAULT/30 bg-acid-DEFAULT/10 px-3 py-1.5 font-semibold text-acid-light hover:bg-acid-DEFAULT/20 disabled:opacity-50"
              >
                Run supported Last-Week baseline using actual history
              </button>
            )}
          </div>
        </div>
      )}
      {/* Scope Disclaimer Banner */}
      <div className="p-4 rounded-2xl glass-panel border border-cobalt/30 bg-cobalt/5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-cobalt-glow shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Latest History: {datasetSummary?.max_date || 'Loading'} · Target: {forecastDate || 'Loading'}</span>
            <StatusPill status="UNOBSERVED TEST DATE" size="sm" />
          </div>
          <p className="text-slate-300 leading-relaxed">
            Today in Asia/Kolkata: {today || 'Loading'}. Forecasts use the active dataset and its weekly cadence; historical observations do not update automatically.
          </p>
        </div>
      </div>

      {/* Control Configuration Console */}
      <BentoCard
        title="Predictive Forecasting Engine Console"
        subtitle="Configure model, horizon, and store targeting"
        headerAction={
          <button
            onClick={() => void handleRunForecast()}
            disabled={generating || loading || !forecastDate || Boolean(forecastDateWarning)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cobalt to-cobalt-light hover:from-cobalt-light hover:to-cobalt text-white text-xs font-bold shadow-cobalt-glow transition-all duration-200 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Executing ML Pipeline...' : 'Run Live Forecast'}</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Forecasting Model Architecture
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setScope((current) => ({ ...current, modelName: e.target.value, lastForecast: null }))}
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
              value={selectedStore ?? ''}
              onChange={(e) => setScope((current) => ({ ...current, storeId: e.target.value ? Number(e.target.value) : null, lastForecast: null }))}
              className="w-full bg-midnight-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cobalt-light cursor-pointer"
            >
              <option value="">All Stores ({datasetSummary?.store_ids.length || 0})</option>
              {(datasetSummary?.store_ids || []).map((s) => (
                <option key={s} value={s}>Store {s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Forecast Date Mode
            </label>
            <select
              value={dateMode}
              onChange={(e) => setScope((current) => ({ ...current, dateMode: e.target.value as 'future' | 'historical', lastForecast: null }))}
              className="w-full bg-midnight-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cobalt-light cursor-pointer"
            >
              <option value="future">Future Forecast</option>
              <option value="historical">Historical Next-Week Evaluation</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              {dateMode === 'future' ? 'Forecast a weekly date after today.' : 'Evaluate the next week after the latest observation.'}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Target Forecast Date
            </label>
            <input
              type="date"
              min={datasetSummary ? addDaysToIsoDate(datasetSummary.max_date, 7) : today}
              step={7}
              value={forecastDate}
              onChange={(e) => setScope((current) => ({ ...current, forecastDate: e.target.value, lastForecast: null }))}
              className="w-full bg-midnight-900/60 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-acid-light font-mono"
            />
            <p className="mt-1 text-[10px] text-slate-500">Choose a date in 7-day increments after the latest observation.</p>
          </div>
        </div>
        {forecastDateWarning && (
          <p className="mt-3 text-xs text-amber-300" role="alert">{forecastDateWarning}</p>
        )}
      </BentoCard>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Forecast Sales"
          value={summary ? `$${(summary.total_forecast_sales / 1e6).toFixed(2)}M` : '—'}
          subtitle={`Sum of point predictions across ${forecasts.length} selected store(s)`}
          accent="cobalt"
        />

        <MetricCard
          title="Mean Store Forecast"
          value={summary ? `$${(summary.mean_store_forecast / 1e3).toFixed(1)}K` : '—'}
          subtitle="Projected revenue per store"
          accent="acid"
        />

        <MetricCard
          title="Empirical Band Width"
          value={summary?.mean_band_width != null ? `$${(summary.mean_band_width / 1e3).toFixed(1)}K` : 'Unavailable'}
          subtitle={summary?.mean_band_width != null ? 'Empirically calibrated interval width' : 'No valid interval calibration for this forecast'}
          accent="cobalt"
        />

        <MetricCard
          title="Upcoming Alert Status"
          value={summary && (summary.alert_counts.NORMAL || summary.alert_counts.HIGH || summary.alert_counts.LOW)
            ? `${summary.alert_counts.NORMAL || 0} NORMAL`
            : summary ? 'Unavailable' : '—'}
          subtitle={summary && (summary.alert_counts.NORMAL || summary.alert_counts.HIGH || summary.alert_counts.LOW)
            ? `${summary.alert_counts.HIGH || 0} High, ${summary.alert_counts.LOW || 0} Low · ${summary.model_used}`
            : summary ? 'No calibrated alert thresholds are available for this forecast.' : 'Generate a forecast to see alert results'}
          accent="acid"
        />
      </div>
      {summary && (
        <p className="text-[11px] text-slate-400">
          Method: <span className="font-semibold text-white">{summary.model_used}</span> ·
          Forecast date: <span className="font-mono text-white">{summary.forecast_date}</span> ·
          Stores forecasted: <span className="font-mono text-white">{forecasts.length}</span>
        </p>
      )}

      {/* Forecast Chart */}
      <BentoCard
        title="Projected Store Sales Distribution with Interval Widths"
        subtitle={`${summary?.model_used || selectedModel} · ${summary?.forecast_date || forecastDate || 'Target date pending'} · point forecasts in $K`}
      >
        <div className="h-64 w-full pt-2">
          {chartData.length ? (
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
                <Bar dataKey="forecast" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                  <ErrorBar dataKey="interval" direction="y" stroke="#A3E635" strokeWidth={1} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-400">
              <p>No forecast results are available yet.</p>
              <p>Run the selected model or use Last-Week baseline when advanced-model history requirements are not met.</p>
            </div>
          )}
        </div>
      </BentoCard>

      <BentoCard
        title="Historical Weekly Sales and Forecast"
        subtitle={`Actuals from the active dataset${actualVsPredicted.length ? ` · ${summary?.model_used} holdout predictions and forecast` : ''}`}
      >
        {historyMessage && <p className="mb-2 text-[11px] text-amber-300">{historyMessage}</p>}
        <div className="h-72 w-full pt-2">
          {historyChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyChartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(value) => String(value).slice(0, 7)} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(value, name) => [typeof value === 'number' ? `$${value.toLocaleString()}` : '—', name]}
                />
                <Legend />
                <Line type="monotone" dataKey="actual" name="Actual weekly sales" stroke="#A3E635" dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="predicted" name={`${summary?.model_used || selectedModel} holdout prediction`} stroke="#60A5FA" dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="Selected-model forecast" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              {historyMessage || 'Loading active dataset history...'}
            </div>
          )}
        </div>
      </BentoCard>

      {/* Detailed Forecast Records Table */}
      <BentoCard
        title="Store-by-Store Forecast Ledger"
        subtitle={`${forecasts.length} actual store forecast${forecasts.length === 1 ? '' : 's'} · ${summary?.model_used || 'No forecast generated'} · ${summary?.forecast_date || 'target date pending'}`}
        headerAction={
          <button
            type="button"
            onClick={handleDownloadForecastCsv}
            disabled={!forecasts.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 border border-white/[0.1] transition-all"
          >
            <Download className="w-3.5 h-3.5 text-acid-light" />
            <span>Download CSV</span>
          </button>
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
              {!forecasts.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-400">
                    No forecast records to display. Generate a forecast with a supported model; no placeholder values are shown.
                  </td>
                </tr>
              )}
              {forecasts.map((f) => {
                const isUndercovered = f.Band_Caution.toLowerCase().includes('below nominal');
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
                      {f.Lower_Bound == null ? 'Unavailable' : `$${f.Lower_Bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {f.Upper_Bound == null ? 'Unavailable' : `$${f.Upper_Bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      {f.Prior_13W_Mean == null ? 'Unavailable' : `$${f.Prior_13W_Mean.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={f.Change_vs_Mean_Pct != null && f.Change_vs_Mean_Pct >= 0 ? 'text-acid-light' : 'text-slate-300'}>
                        {f.Change_vs_Mean_Pct == null ? 'Unavailable' : `${f.Change_vs_Mean_Pct >= 0 ? '+' : ''}${f.Change_vs_Mean_Pct.toFixed(2)}%`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusPill status={f.Alert} size="sm" />
                    </td>
                    <td className="py-2.5 px-3">
                      {isUndercovered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          {f.Band_Caution}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">{f.Band_Caution}</span>
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
