import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { DatasetPage } from './pages/DatasetPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ForecastPage } from './pages/ForecastPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { apiClient } from './api/client';
import { DatasetSummary } from './types/api';
import { ForecastScope, ForecastScopeContext } from './state/ForecastScopeContext';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [datasetVersion, setDatasetVersion] = useState(0);
  const [forecastScope, setForecastScope] = useState<ForecastScope>({
    storeId: null,
    modelName: 'Random Forest',
    forecastDate: '',
    dateMode: 'future',
    lastForecast: null,
  });
  const { dateMode } = forecastScope;

  const fetchSummary = async () => {
    try {
      const sum = await apiClient.getDatasetSummary();
      setDatasetSummary(sum);
    } catch (err) {
      console.error('Failed to load dataset summary', err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [datasetVersion]);

  useEffect(() => {
    apiClient.getForecastTargetDate(dateMode)
      .then((target) => {
        setForecastScope((current) => ({
          ...current,
          forecastDate: target.default_target_date,
          lastForecast: null,
        }));
      })
      .catch((error) => console.error('Failed to load default forecast date', error));
  }, [datasetVersion, dateMode]);

  const handleDatasetChange = async () => {
    setForecastScope((current) => ({ ...current, storeId: null, forecastDate: '', lastForecast: null }));
    await fetchSummary();
    setDatasetVersion((v) => v + 1);
  };

  const handlePdfExport = async () => {
    try {
      const blob = await apiClient.downloadPdf({
        storeId: forecastScope.storeId,
        modelName: forecastScope.modelName,
        forecastDate: forecastScope.forecastDate,
        dateMode: forecastScope.dateMode,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'VORTEX_Retail_Forecasting_Report.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      window.alert(`PDF export failed: ${(error as Error).message}`);
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage key={datasetVersion} onNavigate={(tab) => setActiveTab(tab)} />;
      case 'dataset':
        return <DatasetPage key={datasetVersion} onDatasetChange={handleDatasetChange} />;
      case 'analytics':
        return <AnalyticsPage key={datasetVersion} />;
      case 'forecast':
        return <ForecastPage key={datasetVersion} />;
      case 'comparison':
        return <ComparisonPage key={datasetVersion} />;
      case 'diagnostics':
        return <DiagnosticsPage key={datasetVersion} />;
      case 'reports':
        return <ReportsPage key={datasetVersion} />;
      case 'settings':
        return <SettingsPage key={datasetVersion} />;
      default:
        return <DashboardPage key={datasetVersion} onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <ForecastScopeContext.Provider value={{ scope: forecastScope, setScope: setForecastScope }}>
    <div className="min-h-screen bg-midnight-950 text-slate-100 flex flex-col font-sans selection:bg-cobalt selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        datasetSummary={datasetSummary}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        <Navbar
          activeTab={activeTab}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onQuickForecast={() => setActiveTab('forecast')}
          onAudit={() => setActiveTab('diagnostics')}
          onExportPdf={handlePdfExport}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/[0.06] py-5 px-6 text-center text-xs text-slate-500 bg-midnight-950/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <p>
              &copy; 2026 VORTEX Retail AI Platform &bull; Active-Data Sales Forecasting
            </p>
            <p className="font-mono text-[11px] text-slate-400">
              Random Forest / Gradient Boosting / XGBoost CPU &bull; Python 3.13 &bull; React &bull; Tailwind
            </p>
          </div>
        </footer>
      </div>
    </div>
    </ForecastScopeContext.Provider>
  );
}

export default App;
