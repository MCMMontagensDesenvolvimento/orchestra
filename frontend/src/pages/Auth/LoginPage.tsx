import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, LoaderCircle, ShieldCheck, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { env } from '@/lib/env';
import {
  canStartMicrosoftSso,
  getMicrosoftSsoErrorMessage,
  isSafeMicrosoftSsoLoginUrl,
  redirectToMicrosoftSsoLogin,
} from '@/lib/microsoft-sso';
import { useDevLoginMutation, useSsoConfigQuery } from '@/hooks/queries/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const devLoginMutation = useDevLoginMutation();
  const ssoConfigQuery = useSsoConfigQuery();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(env.useMocks ? 'maria.silva@empresa.com' : 'admin.dev@orchestra.local');
  const [password, setPassword] = useState('password123');
  const [ssoErrorMessage, setSsoErrorMessage] = useState<string | null>(null);
  const [redirectingToSso, setRedirectingToSso] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorCode = params.get('sso_error');
    const safeMessage = getMicrosoftSsoErrorMessage(errorCode);
    if (!safeMessage) return;

    setSsoErrorMessage(safeMessage);
    params.delete('sso_error');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true, state: location.state },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const ssoConfig = ssoConfigQuery.data;
  const ssoLoginUrlIsSafe = isSafeMicrosoftSsoLoginUrl(ssoConfig?.loginUrl);
  const microsoftSsoReady = canStartMicrosoftSso(ssoConfig);
  const showMicrosoftSsoControl = ssoConfigQuery.isLoading || Boolean(ssoConfig);
  const microsoftSsoStatus = useMemo(() => {
    if (ssoConfigQuery.isLoading) return 'Verificando login corporativo Microsoft.';
    if (!ssoConfig) return null;
    if (!ssoConfig.enabled) return 'Login corporativo nao esta habilitado neste ambiente.';
    if (!ssoConfig.configured) return 'Login corporativo ainda nao esta configurado corretamente.';
    if (!ssoLoginUrlIsSafe) return 'Configuracao de login corporativo indisponivel.';
    return 'Use sua conta corporativa para acessar o Orchestra.';
  }, [ssoConfig, ssoConfigQuery.isLoading, ssoLoginUrlIsSafe]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const state = location.state as { from?: { pathname?: string } } | null;
    const redirectTo = state?.from?.pathname ?? '/app/dashboard';

    if (env.useMocks) {
      navigate(redirectTo);
      return;
    }

    try {
      await devLoginMutation.mutateAsync(email);
      navigate(redirectTo);
    } catch {
      // Error state is rendered from the mutation.
    }
  };

  const handleMicrosoftLogin = () => {
    if (!ssoConfig) return;
    setRedirectingToSso(true);
    const redirected = redirectToMicrosoftSsoLogin(ssoConfig);
    if (!redirected) {
      setRedirectingToSso(false);
      setSsoErrorMessage('Login corporativo indisponivel neste ambiente.');
    }
  };

  return (
    <div className="flex min-h-dvh">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="absolute rounded-full border border-primary-foreground/20"
              style={{
                width: `${200 + i * 120}px`, height: `${200 + i * 120}px`,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <div className="relative z-10 max-w-md px-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/20 backdrop-blur">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">ORQUESTRA</h1>
          <p className="text-lg text-primary-foreground/80">
            Plataforma enterprise para criação e gestão de assistentes inteligentes corporativos.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-primary-foreground/70 text-sm">
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <div className="text-2xl font-bold text-primary-foreground">6</div>
              <div>Assistentes</div>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <div className="text-2xl font-bold text-primary-foreground">8</div>
              <div>Servidores MCP</div>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 p-3">
              <div className="text-2xl font-bold text-primary-foreground">99.9%</div>
              <div>Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ORQUESTRA</span>
          </div>
          <h2 className="text-2xl font-bold">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-muted-foreground">Entre com suas credenciais ou acesso corporativo para usar a plataforma.</p>

          {ssoErrorMessage && (
            <Alert variant="destructive" className="mt-6">
              <AlertDescription>{ssoErrorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={(event) => { void handleLogin(event); }} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button type="button" className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Esqueceu a senha?</button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {devLoginMutation.isError && (
              <p className="text-sm text-destructive">
                Nao foi possivel iniciar a sessao. Verifique se o backend local esta disponivel.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={devLoginMutation.isPending}>
              {devLoginMutation.isPending ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {showMicrosoftSsoControl && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>Login corporativo</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!microsoftSsoReady || redirectingToSso || ssoConfigQuery.isLoading}
                onClick={handleMicrosoftLogin}
              >
                {redirectingToSso ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="mr-2 h-4 w-4" />
                )}
                Entrar com Microsoft
              </Button>
              {microsoftSsoStatus && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{microsoftSsoStatus}</span>
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acesso restrito a usuários autorizados. Ao entrar, você concorda com as políticas de uso da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}
