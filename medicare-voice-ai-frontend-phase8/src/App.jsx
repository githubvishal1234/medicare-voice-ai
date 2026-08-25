import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./lib/ProtectedRoute";
import { AdminAuthProvider } from "./lib/adminAuth";
import AdminProtectedRoute from "./lib/AdminProtectedRoute";
import Landing from "./pages/marketing/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/app/Dashboard";
import CallLogs from "./pages/app/CallLogs";
import Appointments from "./pages/app/Appointments";
import Patients from "./pages/app/Patients";
import PatientProfile from "./pages/app/PatientProfile";
import EHRIntegration from "./pages/app/EHRIntegration";
import AgentSettings from "./pages/app/AgentSettings";
import Security from "./pages/app/Security";
import Billing from "./pages/app/Billing";
import KnowledgeBase from "./pages/app/KnowledgeBase";
import Support from "./pages/app/Support";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminOrgDetail from "./pages/admin/AdminOrgDetail";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminUsage from "./pages/admin/AdminUsage";
import AdminAuditLog from "./pages/admin/AdminAuditLog";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/calls" element={<ProtectedRoute><CallLogs /></ProtectedRoute>} />
            <Route path="/app/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/app/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/app/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
            <Route path="/app/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
            <Route path="/app/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/app/ehr" element={<ProtectedRoute><EHRIntegration /></ProtectedRoute>} />
            <Route path="/app/agent" element={<ProtectedRoute><AgentSettings /></ProtectedRoute>} />
            <Route path="/app/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/app/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />

            {/* Super Admin — fully separate auth/session from the routes above */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminProtectedRoute><AdminOverview /></AdminProtectedRoute>} />
            <Route
              path="/admin/organizations"
              element={<AdminProtectedRoute><AdminOrganizations /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/organizations/:id"
              element={<AdminProtectedRoute><AdminOrgDetail /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/users"
              element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/plans"
              element={<AdminProtectedRoute><AdminPlans /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/subscriptions"
              element={<AdminProtectedRoute><AdminSubscriptions /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/usage"
              element={<AdminProtectedRoute><AdminUsage /></AdminProtectedRoute>}
            />
            <Route
              path="/admin/audit-log"
              element={<AdminProtectedRoute><AdminAuditLog /></AdminProtectedRoute>}
            />
          </Routes>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}