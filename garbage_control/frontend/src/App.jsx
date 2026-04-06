import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout";
import RoleGuard from "./components/RoleGuard";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RequestsList from "./pages/RequestsList";
import CreateRequest from "./pages/CreateRequest";
import CompletedRequests from "./pages/CompletedRequests";
import CityStats from "./pages/CityStats";
import Faq from "./pages/Faq";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";

import CoordinatorRequests from "./pages/coord/CoordRequests";
import RequestDetail from "./pages/coord/CoordRequestDetail";
import CoordMap from "./pages/coord/CoordMap";
import OrganizationRequests from "./pages/org/OrganizationRequests";
import OrganizationRequestDetail from "./pages/org/OrganizationRequestDetail";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminDirectories from "./pages/admin/AdminDirectories";
import AdminZones from "./pages/admin/AdminZones";
import AdminLayout from "./pages/admin/AdminLayout";
import WorkerRequests from "./pages/worker/WorkerRequests";
import WorkerRequestDetail from "./pages/worker/WorkerRequestDetail";

import { bootstrapAuth, getMe, logoutUser } from "./api/auth";

export default function App() {
  const location = useLocation();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await bootstrapAuth();
        const currentUser = await getMe();
        setAuthed(true);
        setMe(currentUser);
      } catch {
        setAuthed(false);
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finishAuth = async () => {
    setAuthed(true);
    setMe(await getMe());
  };

  const doLogout = async () => {
    try {
      await logoutUser();
    } finally {
      setAuthed(false);
      setMe(null);
    }
  };

  if (loading) return <div className="container py-4">Загрузка...</div>;

  return (
    <AppLayout authed={authed} role={me?.role} username={me?.username} onLogout={doLogout} pageKey={location.pathname}>
      <Routes>
        <Route path="/login" element={!authed ? <Login onDone={finishAuth} /> : <Navigate to="/requests" />} />
        <Route path="/register" element={!authed ? <Register onDone={finishAuth} /> : <Navigate to="/requests" />} />
        <Route path="/forgot-password" element={!authed ? <ForgotPassword /> : <Navigate to="/requests" />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/faq" element={<Faq />} />

        <Route path="/requests" element={authed ? <RequestsList /> : <Navigate to="/login" />} />
        <Route path="/works" element={authed ? <CompletedRequests /> : <Navigate to="/login" />} />
        <Route path="/stats" element={authed ? <CityStats /> : <Navigate to="/login" />} />
        <Route path="/profile" element={authed ? <Profile initialMe={me} onUpdated={setMe} /> : <Navigate to="/login" />} />
        <Route
          path="/requests/new"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["CITIZEN"]}>
              <CreateRequest />
            </RoleGuard>
          }
        />

        <Route
          path="/coord/requests"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["COORDINATOR"]}>
              <CoordinatorRequests />
            </RoleGuard>
          }
        />
        <Route
          path="/coord/map"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["COORDINATOR"]}>
              <CoordMap />
            </RoleGuard>
          }
        />
        <Route
          path="/coord/requests/:id"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["COORDINATOR", "ADMIN"]}>
              <RequestDetail />
            </RoleGuard>
          }
        />

        <Route
          path="/worker/requests"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["WORKER"]}>
              <WorkerRequests />
            </RoleGuard>
          }
        />
        <Route
          path="/worker/requests/:id"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["WORKER"]}>
              <WorkerRequestDetail />
            </RoleGuard>
          }
        />

        <Route
          path="/org/requests"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ORG_MANAGER"]}>
              <OrganizationRequests />
            </RoleGuard>
          }
        />
        <Route
          path="/org/requests/:id"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ORG_MANAGER"]}>
              <OrganizationRequestDetail />
            </RoleGuard>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ADMIN"]}>
              <AdminLayout />
            </RoleGuard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="directories" element={<AdminDirectories />} />
          <Route path="zones" element={<AdminZones />} />
        </Route>

        <Route path="/" element={authed ? <CompletedRequests /> : <Navigate to="/login" />} />
        <Route path="*" element={<NotFound authed={authed} role={me?.role} />} />
      </Routes>
    </AppLayout>
  );
}
