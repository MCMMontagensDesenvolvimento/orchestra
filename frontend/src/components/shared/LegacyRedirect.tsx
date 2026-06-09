import { Navigate, useLocation } from 'react-router-dom';

/**
 * LegacyRedirect — redireciona rotas antigas (raiz) para o namespace /app/*,
 * preservando subpath, query e hash. Usado para manter links existentes
 * funcionando após a migração da Fase 1.
 */
export default function LegacyRedirect() {
  const loc = useLocation();
  const target = `/app${loc.pathname}${loc.search}${loc.hash}`;
  return <Navigate to={target} replace />;
}
