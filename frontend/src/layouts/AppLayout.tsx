import { Outlet } from 'react-router-dom';

/**
 * AppLayout — área autenticada.
 *
 * Fase 1: atua como agrupador de rotas /app/*. O AppShell (sidebar + topbar)
 * permanece embutido em cada página por ora; em uma fase futura ele será
 * movido para cá e as páginas usarão apenas o conteúdo.
 */
export default function AppLayout() {
  return <Outlet />;
}
