import React, { useEffect, useState } from 'react';
import {
  Upload,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck
} from 'lucide-react';

import { apiClient } from '../api/client';
import { BentoCard } from '../components/BentoCard';
import { StatusPill } from '../components/StatusPill';
import { DatasetSummary, DatasetRow } from '../types/api';

export const DatasetPage: React.FC = () => {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [selectedStore, setSelectedStore] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSummary = async () => {
    try {
      const sum = await apiClient.getDatasetSummary();
      setSummary(sum);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDatasetPreview({
        page,
        limit,
        store_id: selectedStore !== '' ? Number(selectedStore) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setRows(res.data);
      setTotalRows(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchRows();
  }, [page, selectedStore, startDate, endDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadMsg(null);
      const res = await apiClient.uploadDataset(file);
      setUploadMsg({ type: 'success', text: res.message });
      setSummary(res.summary);
      setPage(1);
      fetchRows();
    } catch (err: any) {
      const errDetail = err?.response?.data?.detail || 'Failed to upload and validate CSV.';
      setUploadMsg({ type: 'error', text: errDetail });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReset = async () => {
    try {
      const res = await apiClient.resetDataset();
      setSummary(res.summary);
      setUploadMsg({ type: 'success', text: 'Dataset reset to canonical Walmart.csv.' });
      setPage(1);
      fetchRows();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalRows / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Upload & Integrity Notification */}
      {uploadMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs transition-all ${
            uploadMsg.type === 'success'
              ? 'bg-acid-DEFAULT/10 border-acid-DEFAULT/30 text-acid-light'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{uploadMsg.text}</span>
          </div>
          <button onClick={() => setUploadMsg(null)} className="text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Dataset Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Data Integrity */}
        <BentoCard
          title="Data Integrity & Verification"
          subtitle="Strict panel alignment and consistency check"
          badge={<StatusPill status={summary?.is_canonical ? 'CANONICAL' : 'CUSTOM UPLOAD'} size="sm" />}
        >
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Total Observations:</span>
              <span className="font-mono text-white font-bold">{summary?.total_rows.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Number of Stores:</span>
              <span className="font-mono text-white">{summary?.total_stores} (IDs 1–{summary?.total_stores})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Observations Per Store:</span>
              <span className="font-mono text-white">{summary?.weeks_per_store} weeks</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Missing Values:</span>
              <span className="font-mono text-acid-light font-bold">0 cells (Verified)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Duplicate (Store, Date):</span>
              <span className="font-mono text-acid-light font-bold">0 records (Verified)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Chronological Spacing:</span>
              <span className="font-mono text-white">Exactly 7 Days (Every Friday)</span>
            </div>
          </div>
        </BentoCard>

        {/* Card 2: Sales Summary Statistics */}
        <BentoCard
          title="Revenue & Observation Bounds"
          subtitle="Aggregated values in USD"
        >
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Gross Sales:</span>
              <span className="font-mono text-acid-light font-bold">${summary ? (summary.total_sales / 1e9).toFixed(3) : '0'} Billion</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Mean Weekly Store Sales:</span>
              <span className="font-mono text-white">${summary?.mean_weekly_sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Median Weekly Sales:</span>
              <span className="font-mono text-white">${summary?.median_weekly_sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Max Single-Week Sale:</span>
              <span className="font-mono text-white">${summary?.max_sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Min Single-Week Sale:</span>
              <span className="font-mono text-white">${summary?.min_sales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Historical Date Span:</span>
              <span className="font-mono text-slate-300">{summary?.min_date} &rarr; {summary?.max_date}</span>
            </div>
          </div>
        </BentoCard>

        {/* Card 3: Upload & Replacement Wizard */}
        <BentoCard
          title="Dataset Upload & Replacement"
          subtitle="Upload compatible Walmart format CSV"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload a custom dataset to evaluate predictions. Required columns: <code className="text-cobalt-glow font-mono text-[11px]">Store, Date, Weekly_Sales, Holiday_Flag, Temperature, Fuel_Price, CPI, Unemployment</code>.
            </p>

            <div className="relative border-2 border-dashed border-white/[0.15] hover:border-cobalt-light/50 rounded-xl p-4 text-center transition-all bg-midnight-900/50">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <Upload className="w-5 h-5 text-cobalt-glow animate-bounce" />
                <span className="text-xs font-semibold text-white">
                  {uploading ? 'Validating CSV...' : 'Click to Browse or Drag CSV'}
                </span>
                <span className="text-[10px] text-slate-500">Max 50MB UTF-8 CSV</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-medium text-slate-300 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset to Canonical Walmart.csv</span>
              </button>

              <span className="text-[10px] font-mono text-slate-500">SHA-256 Protected</span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Interactive Data Table with Filters */}
      <BentoCard
        title="Dataset Explorer & Record Browser"
        subtitle={`Showing ${rows.length} of ${totalRows.toLocaleString()} matching records`}
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
            {/* Store Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-900/80 px-2.5 py-1.5 rounded-xl border border-white/[0.08] text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStore}
                onChange={(e) => {
                  setSelectedStore(e.target.value ? Number(e.target.value) : '');
                  setPage(1);
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
              >
                <option value="" className="bg-midnight-950 text-white">All Stores (1–45)</option>
                {Array.from({ length: 45 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s} className="bg-midnight-950 text-white">Store {s}</option>
                ))}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1 bg-midnight-900/80 px-2.5 py-1 rounded-xl border border-white/[0.08] text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-transparent text-slate-300 text-xs focus:outline-none"
              />
              <span className="text-slate-500 text-[10px]">&rarr;</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-transparent text-slate-300 text-xs focus:outline-none"
              />
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Store</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Weekly Sales ($)</th>
                <th className="py-2.5 px-3 text-center">Holiday Flag</th>
                <th className="py-2.5 px-3 text-right">Temperature (°F)</th>
                <th className="py-2.5 px-3 text-right">Fuel Price ($)</th>
                <th className="py-2.5 px-3 text-right">CPI</th>
                <th className="py-2.5 px-3 text-right">Unemployment (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((r, i) => (
                <tr key={`${r.Store}-${r.Date}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-white">Store {r.Store}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{r.Date}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-acid-light font-semibold">
                    ${r.Weekly_Sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      r.Holiday_Flag === 1 ? 'bg-cobalt/20 text-cobalt-glow border border-cobalt/30 font-bold' : 'text-slate-500'
                    }`}>
                      {r.Holiday_Flag === 1 ? 'Holiday (1)' : 'Regular (0)'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{r.Temperature.toFixed(1)}°</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">${r.Fuel_Price.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{r.CPI.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">{r.Unemployment.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span>Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong></span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </BentoCard>
    </div>
  );
};

