import { Outlet } from 'react-router-dom';

/**
 * ProtectedRoute — gate visual para área autenticada.
 *
 * MOCK Fase 1: sempre considera autenticado. Em fases futuras, validar sessão
 * real (auth do Lovable Cloud / backend) e redirecionar para /login quando
 * não autenticado, preservando a rota de retorno.
 */
export default function ProtectedRoute() {
  const isAuthenticated = true; // TODO: substituir por sessão real
  if (!isAuthenticated) {
    // return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
