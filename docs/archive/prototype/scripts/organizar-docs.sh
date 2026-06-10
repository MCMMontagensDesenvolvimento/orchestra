#!/usr/bin/env bash
set -euo pipefail

# Execute este script na raiz do repositório:
# ./scripts/organizar-docs.sh
#
# Ele cria a estrutura recomendada em /docs e move arquivos já existentes
# para os diretórios corporativos correspondentes.

mkdir -p docs/decisions
mkdir -p docs/governance
mkdir -p docs/product
mkdir -p docs/architecture
mkdir -p docs/engineering
mkdir -p docs/security
mkdir -p docs/project-management/marcos-metricas
mkdir -p docs/project-management/snapshots
mkdir -p docs/stakeholders
mkdir -p docs/support/roteiros

# Manter diretórios vazios versionáveis, se necessário.
touch docs/architecture/.gitkeep
touch docs/engineering/.gitkeep
touch docs/security/.gitkeep
touch docs/support/roteiros/.gitkeep

# decision -> decisions
if [ -f "docs/decision/decision-log.md" ]; then
  mv "docs/decision/decision-log.md" "docs/decisions/decision-log.md"
fi

# Remove diretório antigo se estiver vazio.
if [ -d "docs/decision" ]; then
  rmdir "docs/decision" 2>/dev/null || true
fi

# Snapshot técnico do marco inicial.
if [ -f "docs/Orquestra_Documentacao_Tecnica_Estado_Atual.md" ]; then
  mv "docs/Orquestra_Documentacao_Tecnica_Estado_Atual.md" "docs/project-management/snapshots/M0_000_ORQUESTRA_DOCUMENTACAO_TECNICA_ESTADO_ATUAL.md"
fi

# Levantamento de decisões com stakeholder.
if [ -f "docs/QUESTIONARIO_DECISOES_PENDENTES_VITOR.md" ]; then
  mv "docs/QUESTIONARIO_DECISOES_PENDENTES_VITOR.md" "docs/stakeholders/LEVANTAMENTO_DECISOES_INICIAIS_VITOR.md"
fi

if [ -f "docs/README_DECISOES_INICIAIS_ORQUESTRA.md" ]; then
  mv "docs/README_DECISOES_INICIAIS_ORQUESTRA.md" "docs/stakeholders/README_LEVANTAMENTOS.md"
fi

# Roteiro técnico de geração de snapshots.
if [ -f "docs/project-management/marcos-metricas/PROMPT_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md" ]; then
  mv "docs/project-management/marcos-metricas/PROMPT_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md" "docs/project-management/marcos-metricas/ROTEIRO_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md"
fi

echo "Estrutura de documentação organizada com sucesso."
