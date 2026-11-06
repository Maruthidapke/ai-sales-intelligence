import axios from 'axios';
import {
  DatasetSummary,
  UploadedDataset,
  ForecastTargetDate,
  SalesAnalytics,
  StoreRanking,
  BenchmarkModel,
  BacktestModel,
  StoreForecast,
  ForecastSummary,
  DiagnosticsData,
  ResidualsAnalysis,
  ActualVsPredictedPoint,
  ForecastGenerationResponse
} from '../types/api';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

export const apiClient = {
  // Health
  getHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  // Dataset
  getDatasetSummary: async (storeId?: number | null): Promise<DatasetSummary> => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/dataset/summary', { params });
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

  getUploadedDatasets: async (): Promise<UploadedDataset[]> => {
    const res = await api.get('/dataset/uploads');
    return res.data.data;
  },

  activateUploadedDataset: async (storedFilename: string) => {
    const res = await api.post(`/dataset/uploads/${encodeURIComponent(storedFilename)}/activate`);
    return res.data;
  },

  downloadUploadedDatasetUrl: (storedFilename: string) =>
    `/api/dataset/uploads/${encodeURIComponent(storedFilename)}/download`,

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
  getBenchmarks: async (storeId?: number | null): Promise<BenchmarkModel[]> => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/models/benchmarks', { params });
    return res.data.data;
  },

  getNestedBacktests: async (storeId?: number | null): Promise<BacktestModel[]> => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/models/backtest', { params });
    return res.data.data;
  },

  getStabilityData: async (storeId?: number | null) => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/models/stability', { params });
    return res.data.data;
  },

  getDiagnostics: async (storeId?: number | null): Promise<DiagnosticsData> => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/models/diagnostics', { params });
    return res.data;
  },

  getLeakageAudit: async (storeId?: number | null) => {
    const params = storeId == null ? {} : { store_id: storeId };
    const res = await api.get('/models/leakage-audit', { params });
    return res.data.data;
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

  getActualVsPredicted: async (storeId?: number | null, modelName?: string): Promise<ActualVsPredictedPoint[]> => {
    const params: { store_id?: number; model_name?: string } = {};
    if (storeId != null) params.store_id = storeId;
    if (modelName) params.model_name = modelName;
    const res = await api.get('/forecast/actual-vs-predicted', { params });
    return res.data.data;
  },

  getForecastTargetDate: async (mode: 'future' | 'historical' = 'future'): Promise<ForecastTargetDate> => {
    const res = await api.get('/forecast/target-date', { params: { mode } });
    return res.data;
  },

  generateForecast: async (
    storeId?: number | null,
    modelName?: string,
    forecastDate?: string,
    dateMode: 'future' | 'historical' = 'future',
  ): Promise<ForecastGenerationResponse> => {
    const res = await api.post('/forecast/generate', {
      store_id: storeId,
      model_name: modelName || 'Random Forest',
      forecast_date: forecastDate,
      date_mode: dateMode,
    });
    return res.data;
  },

  // Reports
  downloadPdf: async (scope?: {
    storeId?: number | null;
    modelName?: string;
    forecastDate?: string;
    dateMode?: 'future' | 'historical';
  }): Promise<Blob> => {
    const res = await api.get('/reports/pdf', {
      responseType: 'blob',
      params: {
        store_id: scope?.storeId ?? undefined,
        model_name: scope?.modelName,
        forecast_date: scope?.forecastDate || undefined,
        date_mode: scope?.dateMode,
      },
    });
    const contentType = String(res.headers['content-type'] || '');
    if (!contentType.includes('application/pdf')) {
      const body = await res.data.text();
      let detail = body;
      try {
        detail = JSON.parse(body).detail || body;
      } catch {
        // The server may return a plain-text error response.
      }
      throw new Error(detail || `Expected a PDF response, received ${contentType || 'an unknown content type'}.`);
    }
    const signature = new Uint8Array(await res.data.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(signature) !== '%PDF-') {
      throw new Error('The report response did not contain a valid PDF signature.');
    }
    return res.data;
  },

  downloadForecastCsv: async (scope?: {
    storeId?: number | null;
    modelName?: string;
    forecastDate?: string;
    dateMode?: 'future' | 'historical';
  }): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.get('/reports/csv', {
      responseType: 'blob',
      params: {
        store_id: scope?.storeId ?? undefined,
        model_name: scope?.modelName,
        forecast_date: scope?.forecastDate || undefined,
        date_mode: scope?.dateMode,
      },
    });
    const contentType = String(res.headers['content-type'] || '');
    if (!contentType.includes('text/csv')) {
      const body = await res.data.text();
      let detail = body;
      try {
        detail = JSON.parse(body).detail || body;
      } catch {
        // The server may return a plain-text error response.
      }
      throw new Error(detail || `Expected a CSV response, received ${contentType || 'an unknown content type'}.`);
    }
    if (!res.data.size) {
      throw new Error('The forecast CSV response was empty.');
    }
    const disposition = String(res.headers['content-disposition'] || '');
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'VORTEX_Forecast.csv';
    return { blob: res.data, filename };
  },
};
