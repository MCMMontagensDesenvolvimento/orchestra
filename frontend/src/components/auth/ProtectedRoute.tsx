import { Outlet } from 'react-router-dom';

/**
 * ProtectedRoute - gate visual para area autenticada.
 *
 * MOCK Fase 1: sempre considera autenticado. Em fases futuras, validar sessao
 * real no backend/auth provider e redirecionar para /login quando nao
 * autenticado, preservando a rota de retorno.
 */
export default function ProtectedRoute() {
  const isAuthenticated = true; // TODO: substituir por sessao real
  if (!isAuthenticated) {
    // return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
