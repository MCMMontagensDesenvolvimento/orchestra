import type { ReactNode } from 'react';
import Forbidden from '@/pages/Errors/Forbidden';

interface PermissionGateProps {
  /** Lista de permissões/roles necessárias (mock visual). */
  allow?: string[];
  /** Quando false, renderiza o estado 403 inline. */
  allowed?: boolean;
  /** Render alternativo para o estado bloqueado (default: <Forbidden inline />). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * PermissionGate — controle visual de permissões.
 *
 * MOCK Fase 1: a checagem real virá da camada de auth/roles em fases futuras.
 * Aceita `allowed` para override explícito e `allow` apenas como anotação
 * declarativa para revisão (não bloqueia ainda).
 */
export default function PermissionGate({ allowed = true, fallback, children }: PermissionGateProps) {
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <Forbidden inline />}</>;
}
