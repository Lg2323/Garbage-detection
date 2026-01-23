import { Navigate } from "react-router-dom";

export default function RoleGuard({ authed, role, allow = [], children }) {
  if (!authed) return <Navigate to="/login" replace />;
  if (!role) return <div className="container py-4">Загрузка...</div>;
  if (allow.length && !allow.includes(role)) return <Navigate to="/requests" replace />;
  return children;
}
