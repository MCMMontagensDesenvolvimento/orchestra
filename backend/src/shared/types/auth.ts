export interface AuthenticatedWorkspace {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

export interface AuthenticatedTenant {
  id: string;
  name: string;
  slug: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  tenant: AuthenticatedTenant;
  workspaces: AuthenticatedWorkspace[];
  roles: string[];
  permissions: string[];
}

export interface SessionPayload {
  sub: string;
  user: AuthenticatedUser;
}
