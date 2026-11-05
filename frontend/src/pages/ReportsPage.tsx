import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Printer
} from 'lucide-react';

import { BentoCard } from '../components/BentoCard';
import { apiClient } from '../api/client';

export const ReportsPage: React.FC = () => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    window.location.href = apiClient.downloadPdfUrl;
    setTimeout(() => setDownloadingPdf(false), 2000);
  };

  const handleDownloadCsv = () => {
    setDownloadingCsv(true);
    window.location.href = apiClient.downloadCsvUrl;
    setTimeout(() => setDownloadingCsv(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cobalt-glow" />
            Publication-Grade Executive Briefings & Dataset Exports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Download verified machine learning benchmarks, store forecast ledgers, and audit-ready PDF summaries
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
                <li>Original 14-Week Holdout Benchmark Model comparison table</li>
                <li>Empirical prediction band coverage & Store 36 caution disclaimer</li>
                <li>Store-by-store sales forecast ledger with nominal 90% bounds</li>
                <li>Zero-leakage chronological validation protocol statement</li>
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
                <li><code className="text-white">Store</code>: Store ID number (1 to 45)</li>
                <li><code className="text-white">Forecast_Date</code>: Target date (2012-11-02)</li>
                <li><code className="text-white">Forecast_Sales</code>: Machine learning point estimate ($)</li>
                <li><code className="text-white">Lower_Bound / Upper_Bound</code>: 90% nominal empirical bands</li>
                <li><code className="text-white">Change_vs_Mean_Pct</code>: Deviation vs 13W moving mean</li>
                <li><code className="text-white">Alert</code>: NORMAL, HIGH, or LOW status</li>
              </ul>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Format: <strong>UTF-8 RFC-4180 CSV</strong></span>
              <span className="text-acid-light font-mono font-medium">45 Rows + Headers</span>
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};

