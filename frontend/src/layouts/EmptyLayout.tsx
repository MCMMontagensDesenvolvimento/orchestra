import { Outlet } from 'react-router-dom';

/**
 * EmptyLayout — páginas full-screen sem chrome (403, 404, 500).
 */
export default function EmptyLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
    </div>
  );
}
