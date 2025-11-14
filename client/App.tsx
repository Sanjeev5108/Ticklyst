import React from "react";
import "./global.css";
import "./utils/suppressReactWarnings";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import {
  suppressResizeObserverWarnings,
  patchResizeObserverRAF,
} from "./utils/errorHandler";
// Suppress noisy ResizeObserver warnings and patch RO callback timing
suppressResizeObserverWarnings();
patchResizeObserverRAF();
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ClientChecklist from "./pages/ClientChecklist";
import ProjectDetail from "./pages/ProjectDetail";
import MainLayout from "./pages/MainLayout";
import ClientManagement from "./pages/ClientManagement";
import ProjectManagement from "./pages/ProjectManagement";
import FrameworkDashboard from "./pages/dashboards/FrameworkDashboard";
import RiskAssessmentDashboard from "./pages/dashboards/RiskAssessmentDashboard";
import FieldworkDashboard from "./pages/dashboards/FieldworkDashboard";
import ReviewDashboard from "./pages/dashboards/ReviewDashboard";
import ATRDashboard from "./pages/dashboards/ATRDashboard";
import StatementOfApplicability from "./pages/dashboards/StatementOfApplicability";
import Settings from "./pages/Settings";
import HRDashboard from "./pages/dashboards/HRDashboard";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/client" element={<ClientManagement />} />
                <Route path="/employee" element={<HRDashboard />} />
                <Route path="/projects" element={<ProjectManagement />} />
                <Route path="/framework" element={<FrameworkDashboard />} />
                <Route
                  path="/risk-assessment"
                  element={<RiskAssessmentDashboard />}
                />
                <Route path="/fieldwork" element={<FieldworkDashboard />} />
                <Route path="/review" element={<ReviewDashboard />} />
                <Route path="/atr" element={<ATRDashboard />} />
                <Route
                  path="/statement-of-applicability"
                  element={<StatementOfApplicability />}
                />
                <Route path="/settings" element={<Settings />} />
                <Route path="/audit-demo" element={<Index />} />
                <Route
                  path="/client/:clientName"
                  element={<ClientChecklist />}
                />
                <Route
                  path="/client/:clientName/project/:projectId"
                  element={<ProjectDetail />}
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const container = document.getElementById("root")!;
// Reuse existing root in HMR/iframe environments to avoid duplicate createRoot warnings
// Cache on the container to survive module reloads
let root = (container as any).__reactRoot as
  | ReturnType<typeof createRoot>
  | undefined;
if (!root) {
  root = createRoot(container);
  (container as any).__reactRoot = root;
}
root.render(<App />);
