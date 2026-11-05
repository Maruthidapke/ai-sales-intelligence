import React from 'react';
import {
  Settings,
  Sliders,
  Shield,
  Info,
  Cpu,
  Layers,
  Code2,
  FileCheck,
  CheckCircle2
} from 'lucide-react';

import { BentoCard } from '../components/BentoCard';
import { StatusPill } from '../components/StatusPill';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/[0.08] flex items-start gap-3">
        <Info className="w-5 h-5 text-cobalt-glow shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h3 className="font-bold text-white text-sm">Platform Architecture & Mathematical Formulations</h3>
          <p className="text-slate-300 leading-relaxed">
            The platform executes reproducible retail forecasting workflows derived from the Walmart dataset (6,435 observations, 45 stores, 143 weeks). Below are the active production hyperparameters, leakage prevention rules, and operational constraints.
          </p>
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
              <span className="font-mono text-white">16 Weeks (720 Observations)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Normalization Scale:</span>
              <span className="font-mono text-white">Prior 13-Week Moving Mean</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Quantile Alert Floor:</span>
              <span className="font-mono text-white">-18.81% (5th Percentile)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Quantile Alert Ceiling:</span>
              <span className="font-mono text-white">+24.17% (95th Percentile)</span>
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
              1. <strong>Strict Chronological Split:</strong> The 14-week test holdout (27 July to 26 October 2012) is held completely separate. No test targets are ever used in preprocessing, lag calculations, or parameter tuning.
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
              &bull; <strong>Historical Horizon:</strong> Predictions are strictly historical (2 November 2012) and do not reflect contemporary Walmart operations.
            </p>
            <p>
              &bull; <strong>Store 36 Coverage:</strong> Aggregate coverage of 98.89% does not guarantee reliable intervals for every store; Store 36 observed only 78.57% holdout coverage.
            </p>
            <p>
              &bull; <strong>Single Holiday Cycle:</strong> After the 53-week warm-up, only a single Thanksgiving/Christmas cycle remains in the development set.
            </p>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};

