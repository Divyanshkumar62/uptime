import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { IncidentsPage } from '../pages/IncidentsPage';
import { MonitorDetailsPage } from '../pages/MonitorDetailsPage';
import { IntegrationsSettingsPage } from '../pages/IntegrationsSettingsPage';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <DashboardLayout />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="monitors/:id" element={<MonitorDetailsPage />} />
        <Route path="settings/integrations" element={<IntegrationsSettingsPage />} />
      </Route>

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
