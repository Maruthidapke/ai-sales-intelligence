import React, { createContext, useContext } from 'react';
import { ForecastGenerationResponse } from '../types/api';

export type ForecastDateMode = 'future' | 'historical';

export interface ForecastScope {
  storeId: number | null;
  modelName: string;
  forecastDate: string;
  dateMode: ForecastDateMode;
  lastForecast: ForecastGenerationResponse | null;
}

interface ForecastScopeContextValue {
  scope: ForecastScope;
  setScope: React.Dispatch<React.SetStateAction<ForecastScope>>;
}

export const ForecastScopeContext = createContext<ForecastScopeContextValue | null>(null);

export const useForecastScope = (): ForecastScopeContextValue => {
  const context = useContext(ForecastScopeContext);
  if (!context) {
    throw new Error('useForecastScope must be used within ForecastScopeContext.Provider.');
  }
  return context;
};
