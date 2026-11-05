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

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const sum = await apiClient.getDatasetSummary();
        setDatasetSummary(sum);
      } catch (err) {
        console.error('Failed to load dataset summary', err);
      }
    };
    fetchSummary();
  }, []);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
      case 'dataset':
        return <DatasetPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'forecast':
        return <ForecastPage />;
      case 'comparison':
        return <ComparisonPage />;
      case 'diagnostics':
        return <DiagnosticsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
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
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/[0.06] py-5 px-6 text-center text-xs text-slate-500 bg-midnight-950/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <p>
              &copy; 2026 VORTEX Retail AI Platform &bull; Walmart Empirical Sales Forecasting
            </p>
            <p className="font-mono text-[11px] text-slate-400">
              Random Forest / Gradient Boosting / XGBoost CPU &bull; Python 3.13 &bull; React &bull; Tailwind
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
