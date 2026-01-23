import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { me } from "../api/admin";

export default function RequireRole({ roles, children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    me()
      .then((u) => setState({ loading: false, ok: roles.includes(u.role) }))
      .catch(() => setState({ loading: false, ok: false }));
  }, []);

  if (state.loading) return <div className="p-4">Загрузка...</div>;
  if (!state.ok) return <Navigate to="/login" replace />;
  return children;
}
