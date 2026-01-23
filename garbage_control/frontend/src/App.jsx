import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout";
import RoleGuard from "./components/RoleGuard";

import Login from "./pages/Login";
import Register from "./pages/Register";
import RequestsList from "./pages/RequestsList";
import CreateRequest from "./pages/CreateRequest";

import CoordinatorRequests from "./pages/coord/RequestDetail";
import RequestDetail from "./pages/coord/RequestDetail";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRequests from "./pages/admin/AdminRequests";

import { bootstrapAuth, logoutUser, getMe } from "./api/auth";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null); // {role,...}

  useEffect(() => {
    (async () => {
      try {
        await bootstrapAuth();
        setAuthed(true);
        const m = await getMe();
        setMe(m);
      } catch {
        setAuthed(false);
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doLogout = async () => {
    await logoutUser();
    setAuthed(false);
    setMe(null);
  };

  if (loading) return <div className="container py-4">Загрузка...</div>;

  return (
    <AppLayout authed={authed} role={me?.role} onLogout={doLogout}>
      <Routes>
        {/* public */}
        <Route path="/login" element={!authed ? <Login onDone={async()=>{ setAuthed(true); setMe(await getMe()); }} /> : <Navigate to="/requests" />} />
        <Route path="/register" element={!authed ? <Register onDone={async()=>{ setAuthed(true); setMe(await getMe()); }} /> : <Navigate to="/requests" />} />

        {/* citizen */}
        <Route path="/requests" element={authed ? <RequestsList /> : <Navigate to="/login" />} />
        <Route
          path="/requests/new"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["CITIZEN"]}>
              <CreateRequest />
            </RoleGuard>
          }
        />

        {/* coordinator */}
        <Route
          path="/coord/requests"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["COORDINATOR", "ADMIN"]}>
              <CoordinatorRequests />
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

        {/* admin */}
        <Route
          path="/admin"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ADMIN"]}>
              <AdminDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ADMIN"]}>
              <AdminUsers />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/requests"
          element={
            <RoleGuard authed={authed} role={me?.role} allow={["ADMIN"]}>
              <AdminRequests />
            </RoleGuard>
          }
        />

        <Route path="/" element={<Navigate to={authed ? "/requests" : "/login"} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppLayout>
  );
}
