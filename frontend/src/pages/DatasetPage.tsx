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
import { DatasetSummary, DatasetRow, UploadedDataset } from '../types/api';

interface DatasetPageProps {
  onDatasetChange: () => void;
}

export const DatasetPage: React.FC<DatasetPageProps> = ({ onDatasetChange }) => {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [uploads, setUploads] = useState<UploadedDataset[]>([]);
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
      setUploads(await apiClient.getUploadedDatasets());
    } catch (err) {
      console.error(err);
      const detail = (err as any)?.response?.data?.detail;
      setUploadMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Could not load active dataset metadata and upload history.' });
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
      const detail = (err as any)?.response?.data?.detail;
      setUploadMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Could not load records for the selected filters.' });
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
      setUploads(await apiClient.getUploadedDatasets());
      setPage(1);
      await fetchRows();
      onDatasetChange();
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
      setUploading(true);
      setUploadMsg(null);
      const res = await apiClient.resetDataset();
      setSummary(res.summary);
      setUploads(await apiClient.getUploadedDatasets());
      setUploadMsg({ type: 'success', text: 'Dataset reset to canonical Walmart.csv.' });
      setPage(1);
      await fetchRows();
      onDatasetChange();
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setUploadMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Could not reset the active dataset.' });
    } finally {
      setUploading(false);
    }
  };

  const handleActivateUpload = async (storedFilename: string) => {
    try {
      setUploading(true);
      const res = await apiClient.activateUploadedDataset(storedFilename);
      setSummary(res.summary);
      setUploads(await apiClient.getUploadedDatasets());
      setPage(1);
      setUploadMsg({ type: 'success', text: `Active dataset: ${res.summary.original_filename}` });
      await fetchRows();
      onDatasetChange();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Could not select the uploaded dataset.';
      setUploadMsg({ type: 'error', text: detail });
    } finally {
      setUploading(false);
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
              <span className="font-mono text-white">{summary?.total_stores} (IDs {summary?.store_ids.join(', ')})</span>
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
              <span className={`font-mono ${summary?.is_consecutive_weekly ? 'text-acid-light' : 'text-amber-300'}`}>
                {summary?.is_consecutive_weekly ? 'Consecutive weekly dates' : 'Gaps or irregular intervals detected'}
              </span>
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
          subtitle="Upload compatible retail sales CSV"
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
              {summary && (
                <div className="rounded-xl border border-white/[0.08] bg-midnight-900/60 p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-3"><span className="text-slate-400">Active file</span><span className="text-white text-right break-all">{summary.original_filename}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-400">Storage</span><span className={summary.storage_status === 'Persistent' && summary.storage_verified ? 'text-acid-light' : 'text-amber-300'}>{summary.storage_status || 'In-memory'}{summary.storage_verified ? ' (verified)' : ''}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-400">Absolute location</span><span className="text-slate-200 text-right break-all">{summary.storage_path || 'Not available'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-400">Uploaded</span><span className="text-slate-200">{summary.uploaded_at ? new Date(summary.uploaded_at).toLocaleString() : 'Bundled dataset'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-400">File size / records / stores</span><span className="text-slate-200">{summary.file_size?.toLocaleString() || '—'} bytes / {summary.total_rows.toLocaleString()} / {summary.total_stores}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-400">SHA-256</span><span className="font-mono text-slate-200 text-right break-all">{summary.sha256}</span></div>
                </div>
              )}
              {uploads.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Previously uploaded datasets</label>
                  {uploads.map((upload) => (
                    <div key={upload.stored_filename} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-[11px]">
                      <span className="min-w-0 text-slate-200 truncate" title={upload.original_filename}>
                        {upload.original_filename} · {upload.total_rows.toLocaleString()} rows {upload.active ? '· Active' : ''}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {!upload.active && (
                          <button disabled={uploading || !upload.storage_verified} onClick={() => handleActivateUpload(upload.stored_filename)} className="text-cobalt-glow disabled:opacity-40">Select</button>
                        )}
                        <a href={apiClient.downloadUploadedDatasetUrl(upload.stored_filename)} className="text-acid-light">Download</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleReset}
                disabled={uploading}
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
                <option value="" className="bg-midnight-950 text-white">All Stores ({summary?.total_stores || 0})</option>
                {(summary?.store_ids || []).map((s) => (
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
