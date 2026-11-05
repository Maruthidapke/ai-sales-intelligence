export interface DatasetSummary {
  sha256: string;
  is_canonical: boolean;
  total_rows: number;
  total_stores: number;
  store_ids: number[];
  weeks_per_store: number;
  min_date: string;
  max_date: string;
  is_consecutive_weekly: boolean;
  total_sales: number;
  mean_weekly_sales: number;
  median_weekly_sales: number;
  std_weekly_sales: number;
  max_sales: number;
  min_sales: number;
  highest_performing_store?: {
    store_id: number;
    total_sales: number;
  };
  best_sales_week?: {
    date: string;
    total_sales: number;
  };
  missing_cells: number;
  duplicate_rows: number;
}

export interface DatasetRow {
  Store: number;
  Date: string;
  Weekly_Sales: number;
  Holiday_Flag: number;
  Temperature: number;
  Fuel_Price: number;
  CPI: number;
  Unemployment: number;
}

export interface SalesTimelinePoint {
  Date_Str: string;
  Weekly_Sales: number;
  Holiday_Flag: number;
}

export interface HolidayStats {
  mean: number;
  std: number;
  count: number;
  total: number;
}

export interface SalesAnalytics {
  store_id: number | null;
  timeline: SalesTimelinePoint[];
  holiday_comparison: {
    Holiday?: HolidayStats;
    'Non-Holiday'?: HolidayStats;
    sales_lift_pct: number;
  };
  monthly_seasonality: {
    month: string;
    avg_sales: number;
  }[];
  yearly_trends?: {
    year: number;
    total_sales: number;
    avg_sales: number;
  }[];
  sales_distribution?: {
    bin: string;
    count: number;
    range_min: number;
    range_max: number;
  }[];
  store_comparison?: {
    store: string;
    store_id: number;
    avg_sales: number;
  }[];
}

export interface StoreRanking {
  Store: number;
  Total_Sales: number;
  Avg_Weekly_Sales: number;
  Min_Weekly_Sales: number;
  Max_Weekly_Sales: number;
  Std_Sales: number;
  Observations: number;
}

export interface BenchmarkModel {
  Model: string;
  Type: string;
  CV_MAE?: number;
  MAE: number;
  RMSE: number;
  'WAPE (%)': number;
  R2: number;
}

export interface BacktestModel {
  Model: string;
  'Pooled MAE (USD)': number;
  'Pooled RMSE (USD)': number;
  'WAPE (%)': number;
}

export interface StoreForecast {
  Store: number;
  Forecast_Date: string;
  Forecast_Sales: number;
  Lower_Bound: number;
  Upper_Bound: number;
  Prior_13W_Mean: number;
  Change_vs_Mean_Pct: number;
  Alert: 'NORMAL' | 'HIGH' | 'LOW';
  Band_Caution: string;
  Status: string;
}

export interface ForecastSummary {
  forecast_date: string;
  total_forecast_sales: number;
  mean_store_forecast: number;
  alert_counts: Record<string, number>;
  undercovered_stores: number[];
  alert_thresholds: {
    low_pct: number;
    high_pct: number;
  };
  mean_band_width: number;
  nominal_coverage: number;
  model_used: string;
}

export interface StoreCoverageItem {
  store: number;
  coverage: number;
  legacy_coverage: number;
}

export interface DiagnosticsData {
  prediction_intervals: {
    workflows: {
      workflow: string;
      overall_coverage: number;
      mean_width_usd: number;
      store14_coverage: number;
      store36_coverage: number;
    }[];
    nominal_target: number;
    undercovered_stores: number[];
    store_coverage_details: StoreCoverageItem[];
    interpretation: string;
  };
  feature_ablation: {
    removed_features: string[];
    models: {
      model: string;
      all_fold_mae_change_pct: number;
      first_fold_share_pct: number;
      later_fold_mean_change_pct: number;
    }[];
    key_insight: string;
  };
  warning_utility: {
    material_movement_threshold_pct: number;
    total_material_movements: number;
    rules: {
      rule: string;
      alerts: number;
      material_moves: number;
      precision: number | null;
      recall: number;
      false_alarms: number;
      missed_moves: number;
      directional_recall: number;
    }[];
    trade_off_explanation: string;
  };
}

export interface ResidualsAnalysis {
  mean_error: number;
  std_error: number;
  outliers_count: number;
  outliers: {
    Store: number;
    Date: string;
    Actual: number;
    Predicted: number;
    Error: number;
    Abs_Error: number;
    Std_Deviations: number;
  }[];
  residual_distribution: {
    bin: string;
    count: number;
    range_min: number;
    range_max: number;
  }[];
  actual_vs_predicted_timeline: {
    Date_Str: string;
    Actual_Sales: number;
    Predicted_Sales: number;
  }[];
  total_eval_points: number;
}

export interface ActualVsPredictedPoint {
  Date: string;
  Actual: number | null;
  Predicted: number;
  Type: string;
}
