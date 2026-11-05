import axios from 'axios';
import {
  DatasetSummary,
  SalesAnalytics,
  StoreRanking,
  BenchmarkModel,
  BacktestModel,
  StoreForecast,
  ForecastSummary,
  DiagnosticsData,
  ResidualsAnalysis,
  ActualVsPredictedPoint
} from '../types/api';

const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

export const apiClient = {
  // Health
  getHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  // Dataset
  getDatasetSummary: async (): Promise<DatasetSummary> => {
    const res = await api.get('/dataset/summary');
    return res.data.data;
  },

  getDatasetPreview: async (params?: { page?: number; limit?: number; store_id?: number; start_date?: string; end_date?: string }) => {
    const res = await api.get('/dataset/preview', { params });
    return res.data;
  },

  uploadDataset: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/dataset/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  resetDataset: async () => {
    const res = await api.post('/dataset/reset');
    return res.data;
  },

  // Analytics
  getSalesAnalytics: async (storeId?: number | null): Promise<SalesAnalytics> => {
    const params = storeId ? { store_id: storeId } : {};
    const res = await api.get('/analytics/sales', { params });
    return res.data;
  },

  getStoreRankings: async (): Promise<{ all_stores: StoreRanking[]; top_stores: StoreRanking[]; bottom_stores: StoreRanking[] }> => {
    const res = await api.get('/analytics/stores');
    return res.data;
  },

  // Models
  getBenchmarks: async (): Promise<BenchmarkModel[]> => {
    const res = await api.get('/models/benchmarks');
    return res.data.data;
  },

  getNestedBacktests: async (): Promise<BacktestModel[]> => {
    const res = await api.get('/models/backtest');
    return res.data.data;
  },

  getStabilityData: async () => {
    const res = await api.get('/models/stability');
    return res.data.data;
  },

  getDiagnostics: async (): Promise<DiagnosticsData> => {
    const res = await api.get('/models/diagnostics');
    return res.data;
  },

  getResidualsAnalysis: async (): Promise<ResidualsAnalysis> => {
    const res = await api.get('/models/residuals');
    return res.data.data;
  },

  getStoreErrors: async () => {
    const res = await api.get('/models/store-errors');
    return res.data.data;
  },

  // Forecast
  getForecastSummary: async (): Promise<ForecastSummary> => {
    const res = await api.get('/forecast/summary');
    return res.data.data;
  },

  getStoreForecasts: async (storeId?: number | null): Promise<StoreForecast[]> => {
    const params = storeId ? { store_id: storeId } : {};
    const res = await api.get('/forecast/stores', { params });
    return res.data.data;
  },

  getActualVsPredicted: async (storeId?: number | null): Promise<ActualVsPredictedPoint[]> => {
    const params = storeId ? { store_id: storeId } : {};
    const res = await api.get('/forecast/actual-vs-predicted', { params });
    return res.data.data;
  },

  generateForecast: async (storeId?: number | null, modelName?: string) => {
    const res = await api.post('/forecast/generate', {
      store_id: storeId,
      model_name: modelName || 'Random Forest',
    });
    return res.data;
  },

  // Reports
  downloadPdfUrl: '/api/reports/pdf',
  downloadCsvUrl: '/api/reports/csv',
};
