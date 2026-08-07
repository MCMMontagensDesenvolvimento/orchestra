import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface AppShellProps {
  children: ReactNode;
}

export const APP_SIDEBAR_COLLAPSED_STORAGE_KEY = 'orchestra.sidebar.collapsed';

function readInitialSidebarState() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(readInitialSidebarState);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // The layout still works when storage is unavailable or blocked by the browser.
      }
      return next;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar desktop (md+) */}
      <div className="hidden md:flex">
        <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>

      {/* Sidebar mobile (drawer) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 border-r-0">
          <AppSidebar
            collapsed={false}
            onToggle={() => {}}
            forceExpanded
            hideToggle
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AppTopbar onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
