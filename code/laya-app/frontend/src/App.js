import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CreateExperimentPage from "./pages/CreateExperimentPage";
import ExperimentDetailsPage from "./pages/ExperimentDetailsPage";
import MapViewPage from "./pages/MapViewPage";
import AdminPage from "./pages/AdminPage";
import PlantingPlanReportPage from "./pages/PlantingPlanReportPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/map-view"
            element={
              <ProtectedRoute>
                <MapViewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-experiment"
            element={
              <ProtectedRoute>
                <CreateExperimentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/experiments/:id"
            element={
              <ProtectedRoute>
                <ExperimentDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/experiments/:id/planting-plan"
            element={
              <ProtectedRoute>
                <PlantingPlanReportPage />
              </ProtectedRoute>
            }
          />

          <Route path="/profile" element={<ProfilePage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;