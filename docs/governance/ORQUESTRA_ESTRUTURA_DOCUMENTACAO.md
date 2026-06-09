# Orquestra — Estrutura de Documentação do Projeto

> Documento de referência para organização da pasta `/docs` do projeto Orquestra.

---

## 1. Objetivo

Padronizar a organização da documentação do Orquestra para facilitar evolução do projeto, leitura por stakeholders, versionamento em repositório e manutenção pela equipe técnica.

A estrutura abaixo separa documentação de produto, arquitetura, engenharia, segurança, governança, decisões, gestão do projeto, snapshots técnicos e levantamentos com stakeholders.

---

## 2. Estrutura recomendada

```txt
orquestra/
└── docs/
    ├── README.md
    │
    ├── decisions/
    │   └── decision-log.md
    │
    ├── governance/
    │   └── ORQUESTRA_DIRETRIZ_DOCUMENTACAO_CORPORATIVA.md
    │
    ├── product/
    │   ├── ORQUESTRA_CONTEXTO_INICIAL_DO_PROJETO.md
    │   ├── ORQUESTRA_BRIEF_MESTRE.md
    │   ├── ORQUESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md
    │   ├── ORQUESTRA_REQUISITOS_DO_SISTEMA.md
    │   └── ORQUESTRA_ESPECIFICACAO_FUNCIONAL.md
    │
    ├── architecture/
    │   ├── ORQUESTRA_ARQUITETURA_DE_SOFTWARE.md
    │   ├── ORQUESTRA_ORQUESTRACAO_DE_IA.md
    │   ├── ORQUESTRA_APIS_E_CONTRATOS.md
    │   └── ORQUESTRA_BANCO_DE_DADOS.md
    │
    ├── engineering/
    │   ├── ORQUESTRA_FRONTEND.md
    │   ├── ORQUESTRA_BACKEND.md
    │   ├── ORQUESTRA_INFRAESTRUTURA.md
    │   ├── ORQUESTRA_CICD.md
    │   ├── ORQUESTRA_OBSERVABILIDADE.md
    │   └── ORQUESTRA_TESTES_E_QUALIDADE.md
    │
    ├── security/
    │   └── ORQUESTRA_SEGURANCA_E_COMPLIANCE.md
    │
    ├── project-management/
    │   ├── marcos-metricas/
    │   │   ├── ORQUESTRA_PLANO_DE_MARCOS_E_METRICAS_DO_MVP.md
    │   │   ├── ROTEIRO_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md
    │   │   └── README_ORQUESTRA_MARCOS_METRICAS.md
    │   │
    │   └── snapshots/
    │       └── M0_000_ORQUESTRA_DOCUMENTACAO_TECNICA_ESTADO_ATUAL.md
    │
    ├── stakeholders/
    │   ├── LEVANTAMENTO_DECISOES_INICIAIS_VITOR.md
    │   └── README_LEVANTAMENTOS.md
    │
    └── support/
        └── roteiros/
            └── README_ROTEIROS.md
```

---

## 3. Responsabilidade de cada diretório

### `docs/decisions/`

Armazena o registro de decisões do projeto.

Uso recomendado:

```txt
docs/decisions/decision-log.md
```

Este arquivo deve concentrar decisões consolidadas sobre escopo, arquitetura, segurança, integrações, permissões, IA, infraestrutura e governança.

---

### `docs/governance/`

Armazena diretrizes de documentação, governança do projeto, padrões de escrita, processo de revisão e orientações corporativas.

Uso inicial:

```txt
docs/governance/ORQUESTRA_DIRETRIZ_DOCUMENTACAO_CORPORATIVA.md
```

---

### `docs/product/`

Armazena documentação de produto e negócio.

Documentos previstos:

```txt
ORQUESTRA_CONTEXTO_INICIAL_DO_PROJETO.md
ORQUESTRA_BRIEF_MESTRE.md
ORQUESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md
ORQUESTRA_REQUISITOS_DO_SISTEMA.md
ORQUESTRA_ESPECIFICACAO_FUNCIONAL.md
```

---

### `docs/architecture/`

Armazena documentos estruturais e decisões técnicas de arquitetura.

Documentos previstos:

```txt
ORQUESTRA_ARQUITETURA_DE_SOFTWARE.md
ORQUESTRA_ORQUESTRACAO_DE_IA.md
ORQUESTRA_APIS_E_CONTRATOS.md
ORQUESTRA_BANCO_DE_DADOS.md
```

---

### `docs/engineering/`

Armazena documentação de implementação, engenharia e operação técnica.

Documentos previstos:

```txt
ORQUESTRA_FRONTEND.md
ORQUESTRA_BACKEND.md
ORQUESTRA_INFRAESTRUTURA.md
ORQUESTRA_CICD.md
ORQUESTRA_OBSERVABILIDADE.md
ORQUESTRA_TESTES_E_QUALIDADE.md
```

---

### `docs/security/`

Armazena documentação de segurança, compliance, privacidade, autenticação, autorização, auditoria e dados sensíveis.

Documento previsto:

```txt
ORQUESTRA_SEGURANCA_E_COMPLIANCE.md
```

---

### `docs/project-management/`

Armazena documentação de acompanhamento, marcos, métricas, snapshots e evolução do MVP.

Subdiretórios:

```txt
marcos-metricas/
snapshots/
```

---

### `docs/stakeholders/`

Armazena levantamentos, entrevistas, respostas de stakeholders e insumos de decisão.

Exemplo:

```txt
LEVANTAMENTO_DECISOES_INICIAIS_VITOR.md
```

---

### `docs/support/`

Armazena roteiros auxiliares e materiais de apoio que ajudam na manutenção do projeto, sem serem documentos centrais de produto ou arquitetura.

Exemplo:

```txt
docs/support/roteiros/
```

---

## 4. Organização dos arquivos já existentes

### Arquivos atuais

```txt
docs/decision/decision-log.md
docs/project-management/marcos-metricas/ORQUESTRA_PLANO_DE_MARCOS_E_METRICAS_DO_MVP.md
docs/project-management/marcos-metricas/PROMPT_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md
docs/project-management/marcos-metricas/README_ORQUESTRA_MARCOS_METRICAS.md
docs/Orquestra_Documentacao_Tecnica_Estado_Atual.md
docs/QUESTIONARIO_DECISOES_PENDENTES_VITOR.md
docs/README_DECISOES_INICIAIS_ORQUESTRA.md
```

### Organização recomendada

```txt
docs/decision/decision-log.md
→ docs/decisions/decision-log.md

docs/Orquestra_Documentacao_Tecnica_Estado_Atual.md
→ docs/project-management/snapshots/M0_000_ORQUESTRA_DOCUMENTACAO_TECNICA_ESTADO_ATUAL.md

docs/QUESTIONARIO_DECISOES_PENDENTES_VITOR.md
→ docs/stakeholders/LEVANTAMENTO_DECISOES_INICIAIS_VITOR.md

docs/README_DECISOES_INICIAIS_ORQUESTRA.md
→ docs/stakeholders/README_LEVANTAMENTOS.md

docs/project-management/marcos-metricas/PROMPT_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md
→ docs/project-management/marcos-metricas/ROTEIRO_ORQUESTRA_GERAR_SNAPSHOT_TECNICO_POR_MARCO.md
```

---

## 5. Novos documentos a adicionar

Os documentos corporativos iniciais devem ser adicionados em:

```txt
docs/governance/ORQUESTRA_DIRETRIZ_DOCUMENTACAO_CORPORATIVA.md

docs/product/ORQUESTRA_CONTEXTO_INICIAL_DO_PROJETO.md
```

---

## 6. Estrutura mínima antes dos próximos documentos

Antes de continuar a documentação, recomenda-se deixar a pasta `/docs` assim:

```txt
orquestra/
└── docs/
    ├── README.md
    ├── decisions/
    │   └── decision-log.md
    ├── governance/
    │   └── ORQUESTRA_DIRETRIZ_DOCUMENTACAO_CORPORATIVA.md
    ├── product/
    │   └── ORQUESTRA_CONTEXTO_INICIAL_DO_PROJETO.md
    ├── architecture/
    ├── engineering/
    ├── security/
    ├── project-management/
    │   ├── marcos-metricas/
    │   └── snapshots/
    ├── stakeholders/
    └── support/
        └── roteiros/
```

Os diretórios vazios podem receber um arquivo `.gitkeep` caso seja necessário versioná-los antes de existirem documentos.

---

## 7. Regras de nomeação

1. Usar nomes corporativos e claros.
2. Evitar nomes que pareçam rascunho, bastidor ou ferramenta.
3. Evitar nomes genéricos como `arquivo.md`, `documento.md`, `prompt.md`.
4. Preferir prefixo `ORQUESTRA_` nos documentos centrais.
5. Para snapshots, usar prefixo de marco:

```txt
M0_000_
M1_025_
M2_050_
M3_075_
M4_100_
```

Exemplo:

```txt
M1_025_ORQUESTRA_DOCUMENTACAO_TECNICA_ESTADO_ATUAL.md
```

---

## 8. Próximos documentos previstos

Após esta organização, os próximos documentos devem entrar em:

```txt
docs/product/ORQUESTRA_BRIEF_MESTRE.md
docs/product/ORQUESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md
docs/product/ORQUESTRA_REQUISITOS_DO_SISTEMA.md
docs/product/ORQUESTRA_ESPECIFICACAO_FUNCIONAL.md
```

Depois, conforme avanço técnico:

```txt
docs/architecture/ORQUESTRA_ARQUITETURA_DE_SOFTWARE.md
docs/architecture/ORQUESTRA_ORQUESTRACAO_DE_IA.md
docs/architecture/ORQUESTRA_APIS_E_CONTRATOS.md
docs/architecture/ORQUESTRA_BANCO_DE_DADOS.md

docs/engineering/ORQUESTRA_FRONTEND.md
docs/engineering/ORQUESTRA_BACKEND.md
docs/engineering/ORQUESTRA_INFRAESTRUTURA.md
docs/engineering/ORQUESTRA_CICD.md
docs/engineering/ORQUESTRA_OBSERVABILIDADE.md

docs/security/ORQUESTRA_SEGURANCA_E_COMPLIANCE.md
```

---

## 9. Conclusão

Com essa estrutura, a documentação do Orquestra fica organizada para receber os próximos documentos de produto, arquitetura, engenharia, segurança, governança e gestão do MVP, mantendo nomenclatura corporativa e adequada ao repositório oficial da MCM.
