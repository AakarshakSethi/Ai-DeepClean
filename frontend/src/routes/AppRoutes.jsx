import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "../pages/Landing";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Review from "../pages/Review";
import Search from "../pages/Search";
import Survey from "../pages/Survey";
import Settings from "../pages/Settings";
import Unsubscribe from "../pages/Unsubscribe";
import Bin from "../pages/Bin"; // Gmail Bin Folder
import Sent from "../pages/Sent";
import Outbox from "../pages/Outbox";
import Spam from "../pages/Spam";

// Protect routes that require a logged-in user
function ProtectedRoute({ children }) {
  const userId = localStorage.getItem("deepclean_user_id");
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Redirect logged-in users away from login/landing pages to dashboard
function PublicRoute({ children }) {
  const userId = localStorage.getItem("deepclean_user_id");
  if (userId) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <Review />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />
        <Route
          path="/survey"
          element={
            <ProtectedRoute>
              <Survey />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unsubscribe"
          element={
            <ProtectedRoute>
              <Unsubscribe />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bin"
          element={
            <ProtectedRoute>
              <Bin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sent"
          element={
            <ProtectedRoute>
              <Sent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbox"
          element={
            <ProtectedRoute>
              <Outbox />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spam"
          element={
            <ProtectedRoute>
              <Spam />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}