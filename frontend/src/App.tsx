import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import ChatLayout from "./layouts/ChatLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import SettingsLayout from "./layouts/SettingsLayout";
import EmptyLayout from "./layouts/EmptyLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LegacyRedirect from "./components/shared/LegacyRedirect";

import LoginPage from "./pages/Auth/LoginPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import AssistantsPage from "./pages/Assistants/AssistantsPage";
import AssistantDetailPage from "./pages/Assistants/AssistantDetailPage";
import AssistantWizardPage from "./pages/Assistants/AssistantWizardPage";
import KnowledgePage from "./pages/Knowledge/KnowledgePage";
import KnowledgeDetailPage from "./pages/Knowledge/KnowledgeDetailPage";
import McpHubPage from "./pages/MCP/McpHubPage";
import McpDetailPage from "./pages/MCP/McpDetailPage";
import ChatPage from "./pages/Chat/ChatPage";
import AnalyticsPage from "./pages/Analytics/AnalyticsPage";
import AuditPage from "./pages/Audit/AuditPage";
import AdminPage from "./pages/Admin/AdminPage";

import Forbidden from "./pages/Errors/Forbidden";
import ServerError from "./pages/Errors/ServerError";
import NotFoundPage from "./pages/Errors/NotFoundPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root → login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Área autenticada — /app/* */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />

              {/* Dashboard + Analytics */}
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>

              {/* Assistants */}
              <Route path="assistants" element={<AssistantsPage />} />
              <Route path="assistants/new" element={<AssistantWizardPage />} />
              <Route path="assistants/:id" element={<AssistantDetailPage />} />
              <Route path="assistants/:id/edit" element={<AssistantWizardPage />} />

              {/* Knowledge */}
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route path="knowledge/:id" element={<KnowledgeDetailPage />} />

              {/* MCP */}
              <Route path="mcp" element={<McpHubPage />} />
              <Route path="mcp/:id" element={<McpDetailPage />} />

              {/* Chat */}
              <Route element={<ChatLayout />}>
                <Route path="chat" element={<ChatPage />} />
                <Route path="chat/:assistantId" element={<ChatPage />} />
              </Route>

              {/* Audit */}
              <Route path="audit" element={<AuditPage />} />

              {/* Admin / Settings / Profile */}
              <Route element={<SettingsLayout />}>
                <Route path="admin" element={<Navigate to="/app/admin/users" replace />} />
                <Route path="admin/users" element={<AdminPage />} />
                <Route path="admin/roles" element={<AdminPage />} />
                <Route path="admin/settings" element={<AdminPage />} />
                <Route path="settings" element={<AdminPage />} />
                <Route path="profile" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          {/* Redirects legados (raiz → /app/*) */}
          <Route path="/dashboard/*" element={<LegacyRedirect />} />
          <Route path="/assistants/*" element={<LegacyRedirect />} />
          <Route path="/knowledge/*" element={<LegacyRedirect />} />
          <Route path="/mcp/*" element={<LegacyRedirect />} />
          <Route path="/chat/*" element={<LegacyRedirect />} />
          <Route path="/analytics/*" element={<LegacyRedirect />} />
          <Route path="/audit/*" element={<LegacyRedirect />} />
          <Route path="/admin/*" element={<LegacyRedirect />} />
          <Route path="/settings/*" element={<LegacyRedirect />} />
          <Route path="/profile/*" element={<LegacyRedirect />} />

          {/* Páginas de erro */}
          <Route element={<EmptyLayout />}>
            <Route path="/403" element={<Forbidden />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/500" element={<ServerError />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
