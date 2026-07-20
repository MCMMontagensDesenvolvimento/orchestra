export const protocolVersion = 'orchestra-mcp-http-readonly/1.0';

export const catalogItems = Object.freeze([
  Object.freeze({ id: 'svc-catalog', name: 'Catalog Service', category: 'service', status: 'operational' }),
  Object.freeze({ id: 'svc-search', name: 'Search Service', category: 'service', status: 'operational' }),
  Object.freeze({ id: 'job-demo-sync', name: 'Demo Sync Job', category: 'job', status: 'paused' }),
  Object.freeze({ id: 'dataset-sample', name: 'Sample Dataset', category: 'dataset', status: 'available' }),
]);

export const tools = Object.freeze([
  Object.freeze({
    externalName: 'catalog.search',
    displayName: 'Catalog Search',
    description: 'Read matching fictitious catalog entries by name or category.',
    readOnly: true,
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 80 },
        maxResults: { type: 'integer', minimum: 1, maximum: 5, default: 5 },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['matches'],
      properties: {
        matches: { type: 'array', maxItems: 5, items: { type: 'object' } },
      },
    },
  }),
  Object.freeze({
    externalName: 'catalog.get_status',
    displayName: 'Catalog Get Status',
    description: 'Read the status of one fictitious catalog entry.',
    readOnly: true,
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['itemId'],
      properties: {
        itemId: { type: 'string', minLength: 1, maxLength: 80 },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['found'],
      properties: {
        found: { type: 'boolean' },
        itemId: { type: 'string' },
        status: { type: 'string' },
      },
    },
  }),
]);
