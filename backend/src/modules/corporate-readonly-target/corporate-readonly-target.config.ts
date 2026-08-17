import { env } from '../../config/env';

export const corporateReadonlyTargetTokenMinLength = 12;
export const corporateReadonlyTargetTokenMaxLength = 4096;

export interface CorporateReadonlyTargetConfig {
  enabled: boolean;
  token?: string;
}

export function isValidCorporateReadonlyTargetToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= corporateReadonlyTargetTokenMinLength
    && value.length <= corporateReadonlyTargetTokenMaxLength
    && /^[\x21-\x7e]+$/.test(value);
}

export function getCorporateReadonlyTargetConfig(): CorporateReadonlyTargetConfig {
  return {
    enabled: env.MCP_CORPORATE_READONLY_TARGET_ENABLED,
    token: env.ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN,
  };
}
