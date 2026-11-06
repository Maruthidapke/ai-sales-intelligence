import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

import { BentoCard } from '../components/BentoCard';
import { apiClient } from '../api/client';
import { DatasetSummary } from '../types/api';

export const SettingsPage: React.FC = () => {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getDatasetSummary()
      .then(setDataset)
      .catch((error) => {
        console.error(error);
        setLoadError('Active dataset metadata is unavailable.');
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/[0.08] flex items-start gap-3">
        <Info className="w-5 h-5 text-cobalt-glow shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h3 className="font-bold text-white text-sm">Platform Architecture & Mathematical Formulations</h3>
          <p className="text-slate-300 leading-relaxed">
            Active dataset: {dataset?.original_filename || (dataset ? 'Canonical dataset' : 'Loading')} · {dataset ? `${dataset.total_rows.toLocaleString()} records, ${dataset.total_stores} stores, ${dataset.weeks_per_store} minimum weeks per store` : 'dataset statistics loading'}. Forecasts and diagnostics use the selected dataset.
          </p>
          {loadError && <p className="text-rose-300">{loadError}</p>}
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ML Configuration Settings */}
        <BentoCard
          title="Machine Learning Engine Settings"
          subtitle="Unified model architecture and pipeline parameters"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Production Model:</span>
              <span className="font-mono text-white font-bold">Random Forest Regressor</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Estimators Count:</span>
              <span className="font-mono text-white">160 Trees</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Max Tree Depth:</span>
              <span className="font-mono text-white">None (Full tree expansion)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Min Samples Leaf:</span>
              <span className="font-mono text-white">1</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Store Preprocessing:</span>
              <span className="font-mono text-white">OneHotEncoder (Fitted in Pipeline)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Random State Seed:</span>
              <span className="font-mono text-acid-light font-bold">42 (Strict Reproducibility)</span>
            </div>
          </div>
        </BentoCard>

        {/* Prediction Interval & Alert Thresholds */}
        <BentoCard
          title="Uncertainty & Alert Parameters"
          subtitle="Empirical residual scaling and movement thresholds"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Nominal Interval Coverage:</span>
              <span className="font-mono text-acid-light font-bold">90.0%</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Calibration Window:</span>
              <span className="font-mono text-white">Up to 16 chronological weeks</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Normalization Scale:</span>
              <span className="font-mono text-white">Prior 13-Week Moving Mean</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Quantile Alert Floor:</span>
              <span className="font-mono text-white">Active-data 5th percentile</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Quantile Alert Ceiling:</span>
              <span className="font-mono text-white">Active-data 95th percentile</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Fixed Baseline Comparison:</span>
              <span className="font-mono text-slate-300">&plusmn;15.0% Fixed Threshold</span>
            </div>
          </div>
        </BentoCard>

        {/* Leakage Prevention & Methodological Scope */}
        <BentoCard
          title="Information Boundary & Leakage Protocol"
          subtitle="Strict rules governing data flow and feature construction"
        >
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              1. <strong>Strict Chronological Split:</strong> Training rows precede holdout rows. Preprocessing is fitted on training data only; holdout targets are not used in feature construction or model fitting.
            </p>
            <p>
              2. <strong>Past-Only Shift Operators:</strong> Every rolling mean and standard deviation enforces <code className="text-cobalt-glow font-mono text-[11px]">.shift(1)</code> before calculation. Lags start strictly at Lag 1 (1 week prior).
            </p>
            <p>
              3. <strong>Exclusion of Same-Week Factors:</strong> Same-week temperature, fuel price, CPI, and unemployment are excluded because their contemporaneous availability at forecast origin is unverified.
            </p>
          </div>
        </BentoCard>

        {/* Known Limitations */}
        <BentoCard
          title="Known System Limitations & Scope"
          subtitle="Academic constraints and operational boundaries"
        >
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              &bull; <strong>History Requirement:</strong> Advanced models need at least 54 weekly observations per store and 50 supervised rows after the 53-week feature warm-up. Short datasets can use the Last-week baseline when it has enough history.
            </p>
            <p>
              &bull; <strong>Forecast Horizon:</strong> The default target is one week after the latest active observation. Forecasts are limited to 52 weekly steps and may be historical relative to today when the uploaded data is old.
            </p>
            <p>
              &bull; <strong>Prediction Intervals:</strong> Empirical intervals are available only for supported one-week Random Forest forecasts with enough chronological calibration data; baselines do not claim calibrated bounds.
            </p>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};
