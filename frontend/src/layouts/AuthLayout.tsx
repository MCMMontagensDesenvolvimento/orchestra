import { Outlet } from 'react-router-dom';

/**
 * AuthLayout — telas de autenticação (login, recuperação, etc.).
 * Fase 1: placeholder estrutural. Login mantém seu próprio shell visual.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <Outlet />
    </div>
  );
}
