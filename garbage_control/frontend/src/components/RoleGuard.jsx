import { Navigate } from "react-router-dom";
import AccessDenied from "../pages/AccessDenied";

export default function RoleGuard({ authed, role, allow = [], children }) {
  if (!authed) return <Navigate to="/login" replace />;
  if (!role) return <div className="container py-4">Загрузка...</div>;
  if (allow.length && !allow.includes(role)) return <AccessDenied role={role} />;
  return children;
}
