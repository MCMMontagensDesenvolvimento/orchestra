import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { env } from '@/lib/env';
import { useCurrentSession } from '@/hooks/queries/useAuth';

export default function ProtectedRoute() {
  const location = useLocation();
  const sessionQuery = useCurrentSession();

  if (env.useMocks && env.mockModeAllowed) return <Outlet />;

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Carregando sessao...
      </div>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
