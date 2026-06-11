import type { RuntimeRunInput, RuntimeRunResult } from './runtime.types';

export interface RuntimeAdapter {
  startRun(input: RuntimeRunInput): Promise<RuntimeRunResult>;
  cancelRun(input: { runId: string; traceId: string }): Promise<RuntimeRunResult>;
}
