import React, { useEffect, useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  FileCheck2
} from 'lucide-react';

import { BentoCard } from '../components/BentoCard';
import { apiClient } from '../api/client';
import { DatasetSummary } from '../types/api';
import { useForecastScope } from '../state/ForecastScopeContext';

export const ReportsPage: React.FC = () => {
  const { scope } = useForecastScope();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);

  useEffect(() => {
    apiClient.getDatasetSummary()
      .then(setDataset)
      .catch((error) => {
        console.error(error);
        setDownloadError('Active dataset metadata is unavailable.');
      });
  }, []);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      setDownloadError(null);
      triggerDownload(await apiClient.downloadPdf({
        storeId: scope.storeId,
        modelName: scope.modelName,
        forecastDate: scope.forecastDate,
        dateMode: scope.dateMode,
      }), 'VORTEX_Retail_Forecasting_Report.pdf');
    } catch (error) {
      const message = (error as Error).message || 'PDF report generation failed.';
      setDownloadError(message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setDownloadingCsv(true);
      setDownloadError(null);
      const { blob, filename } = await apiClient.downloadForecastCsv({
        storeId: scope.storeId,
        modelName: scope.modelName,
        forecastDate: scope.forecastDate,
        dateMode: scope.dateMode,
      });
      triggerDownload(blob, filename);
    } catch (error) {
      console.error(error);
      setDownloadError((error as Error).message || 'Forecast CSV generation failed.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {downloadError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200" role="alert">
          {downloadError}
        </div>
      )}
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cobalt-glow" />
            Publication-Grade Executive Briefings & Dataset Exports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Exports use the active dataset{dataset ? ` (${dataset.original_filename || 'canonical dataset'}, ${dataset.total_rows.toLocaleString()} records)` : ''}
            {` · ${scope.storeId == null ? 'All stores' : `Store ${scope.storeId}`} · ${scope.modelName} · ${scope.dateMode === 'future' ? 'Future Forecast' : 'Historical Next-Week Evaluation'}`}
            {scope.forecastDate ? ` · ${scope.forecastDate}` : ''}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cobalt to-cobalt-light hover:from-cobalt-light hover:to-cobalt text-white text-xs font-bold shadow-cobalt-glow transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download Executive PDF'}</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.08] text-slate-200 text-xs font-semibold border border-white/[0.1] transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-acid-light" />
            <span>{downloadingCsv ? 'Preparing CSV...' : 'Download Forecast CSV'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Report Formats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Executive Report Card */}
        <BentoCard
          title="Executive Intelligence PDF Document"
          subtitle="Engineered with ReportLab | Multi-section analytical breakdown"
          headerAction={
            <button
              onClick={handleDownloadPdf}
              className="text-xs text-cobalt-glow hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Download</span> &darr;
            </button>
          }
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-midnight-900 border border-white/[0.06] space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-white font-semibold">
                <FileText className="w-4 h-4 text-cobalt-glow" />
                <span>Document Contents Overview</span>
              </div>
              <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
                <li>Executive Dataset Summary & SHA-256 fingerprint</li>
                <li>Active-dataset chronological holdout model comparison when sufficient history exists</li>
                <li>Runtime prediction-interval reliability results and applicable limitations</li>
                <li>Forecast ledger for the selected scope and model only when actual results can be generated</li>
                <li>Selected store, model, target date and forecast mode</li>
                <li>Active dataset identity, dimensions, and SHA-256 fingerprint</li>
              </ul>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Format: <strong>Standard US-Letter PDF</strong></span>
              <span className="text-acid-light font-mono font-medium">Ready for Download</span>
            </div>
          </div>
        </BentoCard>

        {/* CSV Data Ledgers Card */}
        <BentoCard
          title="Raw Store Forecast & Metrics CSV Export"
          subtitle="Tabular output suitable for BI platforms, Excel, or downstream ERP"
          headerAction={
            <button
              onClick={handleDownloadCsv}
              className="text-xs text-acid-light hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Download</span> &darr;
            </button>
          }
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-midnight-900 border border-white/[0.06] space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-white font-semibold">
                <FileSpreadsheet className="w-4 h-4 text-acid-light" />
                <span>Exported Columns & Fields</span>
              </div>
              <ul className="space-y-1.5 text-slate-400 text-[11px] list-disc list-inside">
                <li><code className="text-white">Store</code>: Store IDs present in the active dataset</li>
                <li><code className="text-white">Forecast_Date</code>: One week after the latest active observation</li>
                <li><code className="text-white">Forecast_Sales</code>: Supported point forecast ($)</li>
                <li><code className="text-white">Lower_Bound / Upper_Bound</code>: Available only where calibrated</li>
                <li><code className="text-white">Change_vs_Mean_Pct</code>: Deviation vs 13W moving mean</li>
                <li><code className="text-white">Alert</code>: NORMAL, HIGH, or LOW status</li>
              </ul>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Format: <strong>UTF-8 RFC-4180 CSV</strong></span>
              <span className="text-acid-light font-mono font-medium">{dataset ? `${dataset.total_stores} store forecasts` : 'Active store forecasts'}</span>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};
