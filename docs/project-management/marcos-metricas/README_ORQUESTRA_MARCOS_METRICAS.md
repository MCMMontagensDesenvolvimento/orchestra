# Pacote — Marcos e Métricas do MVP Orquestra

Este pacote contém os documentos necessários para iniciar o controle de avanço do MVP do Orquestra por marcos:

- `ORQUESTRA_PLANO_DE_MARCOS_E_METRICAS_DO_MVP.md`  
  Define os marcos 0%, 25%, 50%, 75% e 100%, critérios de aceite, scorecard ponderado e regras de aprovação.

- `PROMPT_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md`  
  Prompt reutilizável para gerar novos snapshots técnicos quando o projeto atingir 25%, 50%, 75% e 100%.

## Como usar

1. Manter o documento de plano como referência de governança do MVP.
2. Quando o projeto atingir um marco, preencher o prompt com:
   - snapshot M0;
   - snapshot anterior;
   - critérios do marco atual;
   - código atual;
   - decisões tomadas.
3. Rodar a auditoria na ferramenta escolhida.
4. Salvar o novo snapshot com o nome recomendado:
   - `ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M1_025.md`
   - `ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M2_050.md`
   - `ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M3_075.md`
   - `ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M4_100_MVP.md`
