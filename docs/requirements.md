# Requirements — LogEstoque

> **Projeto:** TCC — Sistema de Gestão de Estoque e Logística  
> **Stack:** SAP CAP (Node.js) + SAP Fiori Elements (SAPUI5) + PostgreSQL  
> **Hospedagem:** VPS Linux via Docker Compose (fora do SAP BTP)

---

## 1. Objetivo do Sistema

O **LogEstoque** gerencia o ciclo de vida de materiais entre armazéns de centros de distribuição: cadastro de materiais e locais de armazenagem, registro e aprovação de movimentações de estoque, e rastreabilidade completa via histórico imutável.

---

## 2. Atores

| Ator | Descrição |
|---|---|
| **ADMIN** | Acesso total ao sistema; gerencia usuários, permissões e dados mestres |
| **ESTOQUE** | Cria e conclui movimentações de estoque |
| **APROVACAO** | Aprova ou rejeita movimentações pendentes |
| **VIEWER** | Somente leitura; consulta posição de estoque e histórico |
| **LOGISTICA** | Equipe de logística; acesso a relatórios e movimentações |

---

## 3. Requisitos Funcionais

### 3.1 Módulos

| Módulo | Descrição |
|---|---|
| **Cadastro de Materiais** | CRUD: código único, descrição, unidade de medida, status ativo |
| **Centros de Distribuição** | CRUD de CDs com endereço e composição de armazéns |
| **Armazéns** | CRUD vinculado a CDs; capacidade máxima |
| **Endereços** | Entidade reutilizável: logradouro, bairro, cidade, estado, país (ISO), CEP |
| **Controle de Estoque** | Posição atual (quantidade) de cada material por armazém |
| **Movimentações** | Registro de entradas, saídas e transferências com fluxo de aprovação |
| **Histórico de Estoque** | Registro imutável de cada alteração de quantidade |
| **Gestão de Usuários** | CRUD de usuários com controle de permissões por papel |
| **Autenticação** | Login local via JWT gerado pela própria aplicação CAP |

### 3.2 Casos de Uso Principais

#### UC-01: Autenticação
- **Ator:** Todos
- **Pré-condição:** Usuário cadastrado com `active = true`
- **Fluxo:** POST `/auth/login` com `username`/`password` → validação bcrypt → JWT com permissões
- **Pós-condição:** Token JWT válido por 8h; cliente armazena no `sessionStorage`

#### UC-02: Criar Movimentação
- **Ator:** ESTOQUE, ADMIN
- **Pré-condição:** Autenticado; material e armazéns ativos existentes
- **Fluxo:** Seleciona tipo (E/S/T), material, quantidade, armazéns → action `criarMovimentacao` → status `Pendente`
- **Regras:**
  - Entrada (E): `destinationWarehouse` obrigatório
  - Saída (S): `originWarehouse` obrigatório; estoque >= quantidade
  - Transferência (T): ambos obrigatórios; origem ≠ destino
  - Quantidade mínima: 1

#### UC-03: Aprovar Movimentação
- **Ator:** APROVACAO, ADMIN
- **Pré-condição:** Movimentação com status `Pendente`
- **Fluxo:** action `aprovarMovimentacao` → status `Aprovado`

#### UC-04: Rejeitar Movimentação
- **Ator:** APROVACAO, ADMIN
- **Pré-condição:** Status `Pendente` ou `Aprovado`
- **Fluxo:** action `rejeitarMovimentacao(motivo)` → status `Rejeitado`

#### UC-05: Concluir Movimentação
- **Ator:** ESTOQUE, ADMIN
- **Pré-condição:** Status `Aprovado`
- **Fluxo (transação atômica):**
  1. Atualiza `Stocks` (decrementa origem e/ou incrementa destino)
  2. Cria `StockHistory` (1 ou 2 registros)
  3. Muda status para `Concluído` (irreversível)
- **Pós-condição:** Estoque atualizado; histórico criado

#### UC-06: Consultar Posição de Estoque
- **Ator:** Todos (autenticados)
- **Fluxo:** Função `posicaoEstoque(materialID)` → lista de armazéns com quantidade atual

#### UC-07: Gerenciar Usuários e Permissões
- **Ator:** ADMIN
- **Fluxo:** CRUD via `EndpointsService`; senha nunca exposta via OData; hash bcrypt na criação/atualização

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance
- Resposta das queries OData: < 2 s para listas com até 1.000 registros
- Transação de conclusão de movimentação: < 5 s

### 4.2 Disponibilidade
- Alvo: 99% uptime (VPS única, sem HA)
- Restart automático via Docker `restart: unless-stopped`

### 4.3 Segurança
- Autenticação JWT (HS256, 8h expiry)
- Senhas com bcrypt (custo 12)
- TLS 1.2/1.3 via Nginx (terminação)
- Campo `password` nunca exposto via OData

### 4.4 Escalabilidade
- Escopo de TCC: instância única (single-node)
- Banco PostgreSQL isolado em container dedicado com volume persistente

### 4.5 Conformidade
- Padrões SAP Fiori Design Guidelines (tema Horizon)
- Fiori Elements (List Report + Object Page) como padrão de UI
- OData v4 como protocolo de API

### 4.6 Manutenibilidade
- Ambiente de desenvolvimento com SQLite em memória (sem necessidade de PostgreSQL local)
- Dados de seed via CSVs em `test/data/` para desenvolvimento
- Health check endpoint `/health` para monitoramento do container

---

## 5. Regras de Negócio

| Regra | Descrição |
|---|---|
| **RN-01** | Movimentações com status `Concluído` ou `Rejeitado` são imutáveis |
| **RN-02** | `StockHistory` é imutável — nenhuma escrita direta permitida via API |
| **RN-03** | Quantidade em `Stocks` nunca pode ser negativa |
| **RN-04** | Uma Saída ou Transferência exige estoque disponível >= quantidade solicitada |
| **RN-05** | Na Transferência, armazém de origem e destino devem ser distintos |
| **RN-06** | Códigos de Material, CD e Armazém são únicos no sistema |
| **RN-07** | Usuário inativo (`active = false`) não pode autenticar |
| **RN-08** | A senha de usuário nunca é exposta via OData (projeção com `excluding { password }`) |

---

## 6. Fluxo de Status de Movimentação

```
PENDENTE (P)
    ├──[aprovarMovimentacao]──► APROVADO (A)
    │                               └──[concluirMovimentacao]──► CONCLUÍDO (C)  [irreversível]
    │                               └──[rejeitarMovimentacao]──► REJEITADO (R)
    └──[rejeitarMovimentacao]──► REJEITADO (R)
```

---

## 7. Restrições Técnicas

| Restrição | Decisão |
|---|---|
| Sem SAP BTP | VPS Linux via Docker Compose |
| Sem XSUAA | JWT local (`jsonwebtoken` + `bcrypt`) |
| Banco de dados | PostgreSQL 16 (`@cap-js/postgres`) em produção; SQLite em desenvolvimento |
| Proxy | Nginx (TLS termination + reverse proxy) |
| Node.js | 20 LTS |
| SAP CAP | `@sap/cds` v9 |
| SAPUI5 | 1.148.x (tema `sap_horizon`) |
| UI Padrão | Fiori Elements (List Report + Object Page); freestyle apenas para Login e Dashboard |
