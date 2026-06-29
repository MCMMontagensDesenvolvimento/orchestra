import { AppError } from '../../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../../shared/types/auth';
import { paginationMeta } from '../../../shared/validation/pagination';
import {
  mapMcpRemoteCatalogApplyLedgerDetail,
  mapMcpRemoteCatalogApplyLedgerList,
  mapMcpRemoteCatalogEntryDetail,
  mapMcpRemoteCatalogEntryList,
} from './mcp-remote-catalog-admin.mapper';
import { mcpRemoteCatalogAdminRepository } from './mcp-remote-catalog-admin.repository';
import type {
  McpRemoteCatalogApplyLedgersQuery,
  McpRemoteCatalogEntriesQuery,
} from './mcp-remote-catalog-admin.schema';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function assertWorkspaceFilter(user: AuthenticatedUser, workspaceId: string | undefined) {
  if (!workspaceId) return;
  if (!userWorkspaceIds(user).includes(workspaceId)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
  }
}

export const mcpRemoteCatalogAdminService = {
  async listEntries(user: AuthenticatedUser, query: McpRemoteCatalogEntriesQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await mcpRemoteCatalogAdminRepository.listEntries(user.tenant.id, userWorkspaceIds(user), query);

    return {
      data: result.data.map(mapMcpRemoteCatalogEntryList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getEntry(id: string, user: AuthenticatedUser) {
    const entry = await mcpRemoteCatalogAdminRepository.findEntry(id, user.tenant.id, userWorkspaceIds(user));
    if (!entry) {
      throw new AppError(404, 'MCP_REMOTE_CATALOG_ENTRY_NOT_FOUND', 'Entrada do catalogo MCP remoto nao encontrada.');
    }
    return mapMcpRemoteCatalogEntryDetail(entry);
  },

  async listApplyLedgers(user: AuthenticatedUser, query: McpRemoteCatalogApplyLedgersQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await mcpRemoteCatalogAdminRepository.listApplyLedgers(user.tenant.id, userWorkspaceIds(user), query);

    return {
      data: result.data.map(mapMcpRemoteCatalogApplyLedgerList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getApplyLedger(id: string, user: AuthenticatedUser) {
    const ledger = await mcpRemoteCatalogAdminRepository.findApplyLedger(id, user.tenant.id, userWorkspaceIds(user));
    if (!ledger) {
      throw new AppError(404, 'MCP_REMOTE_CATALOG_APPLY_LEDGER_NOT_FOUND', 'Ledger de apply do catalogo MCP remoto nao encontrado.');
    }
    return mapMcpRemoteCatalogApplyLedgerDetail(ledger);
  },
};
