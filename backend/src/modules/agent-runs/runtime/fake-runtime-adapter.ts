import type { RuntimeAdapter } from './runtime-adapter.interface';
import type { RuntimeRunInput, RuntimeRunResult } from './runtime.types';

export class FakeRuntimeAdapter implements RuntimeAdapter {
  async startRun(input: RuntimeRunInput): Promise<RuntimeRunResult> {
    return {
      status: 'completed',
      message: 'Execucao simulada concluida. Runtime real ainda nao configurado.',
      events: [
        {
          type: 'run.started',
          status: 'running',
          message: 'Fronteira de runtime acionada em modo controlado.',
          metadata: {
            mode: input.mode,
            traceId: input.traceId,
          },
        },
        {
          type: 'run.mock_runtime_completed',
          status: 'completed',
          message: 'Fake runtime retornou resposta controlada sem chamar provider externo.',
          metadata: {
            runtime: 'fake',
            externalProvidersCalled: false,
            toolsCalled: false,
          },
        },
        {
          type: 'run.completed',
          status: 'completed',
          message: 'Run finalizado pelo control plane.',
          metadata: {
            runId: input.runId,
          },
        },
      ],
    };
  }

  async cancelRun(input: { runId: string; traceId: string }): Promise<RuntimeRunResult> {
    return {
      status: 'completed',
      message: 'Run cancelado no control plane. Runtime real ainda nao configurado.',
      events: [
        {
          type: 'run.cancelled',
          status: 'cancelled',
          message: 'Cancelamento registrado sem chamada a runtime externo.',
          metadata: {
            runId: input.runId,
            traceId: input.traceId,
          },
        },
      ],
    };
  }
}

export const fakeRuntimeAdapter = new FakeRuntimeAdapter();
