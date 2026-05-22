# Architecture — LogEstoque

> **Padrão:** Monólito Modular com SAP CAP  
> **API Style:** OData v4 (Fiori Elements) + REST puro (autenticação)  
> **Banco:** PostgreSQL 16 (produção) / SQLite in-memory (desenvolvimento)

---

## 1. Padrão Arquitetural

**Monólito Modular** — escolha justificada pelo contexto de TCC e equipe única:

- **Coesão alta** por namespace CDS (`db.auth`, `db.masterdata`, `db.inventory`)
- **Dois serviços OData** distintos com responsabilidades separadas
- **Sem microsserviços:** simplicidade de deploy em VPS única com Docker Compose

---

## 2. Diagrama de Contexto (C4 — Nível 1)

```
┌─────────────────────────────────────────────────────────────┐
│                          VPS Linux                          │
│                                                             │
│  ┌─────────┐    ┌──────────────────────┐    ┌───────────┐  │
│  │  Nginx  │───▶│  CAP Node.js :4004   │───▶│ PostgreSQL│  │
│  │ :80/443 │    │  ┌────────────────┐  │    │  :5432    │  │
│  └─────────┘    │  │  MainService   │  │    └───────────┘  │
│       ▲         │  │  (OData v4)    │  │                   │
│       │         │  ├────────────────┤  │                   │
│  Browser        │  │EndpointsService│  │                   │
│  (Fiori UI)     │  │  (OData v4)    │  │                   │
│                 │  ├────────────────┤  │                   │
│                 │  │  /auth/*       │  │                   │
│                 │  │  (REST)        │  │                   │
│                 │  ├────────────────┤  │                   │
│                 │  │  Fiori App     │  │                   │
│                 │  │  (UI5 static)  │  │                   │
│                 │  └────────────────┘  │                   │
│                 └──────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Diagrama de Containers (C4 — Nível 2)

| Container | Tecnologia | Responsabilidade |
|---|---|---|
| **nginx** | Nginx Alpine | TLS termination, reverse proxy, cache de assets UI5 |
| **app** | Node.js 20 + `@sap/cds` v9 | Serviços OData, autenticação JWT, lógica de negócio, serving do UI5 |
| **postgres** | PostgreSQL 16 Alpine | Persistência de dados; volume Docker persistente |

**Rede:** Bridge interna `logestoque-net`; apenas o Nginx expõe portas ao host (80/443).

---

## 4. Diagrama de Componentes — CAP App (C4 — Nível 3)

```
CAP Node.js App
├── srv/
│   ├── main.cds              ← MainService: projeções e ações para a UI Fiori
│   ├── main-handler.js       ← Handlers das ações de negócio
│   ├── endpoints.cds         ← EndpointsService: CRUD administrativo
│   ├── endpoints-handler.js  ← Handlers de validação e segurança
│   ├── auth-handler.js       ← REST: POST /auth/login, GET /auth/me
│   ├── jwt-middleware.js     ← Intercepta requisições, valida JWT, popula cds.context.user
│   ├── moviment-rules.js     ← Funções puras de validação de regras de negócio
│   └── health-handler.js     ← GET /health
│
├── db/
│   ├── types.cds             ← Enums: MovimentTypes, MovimentStatus
│   ├── auth.cds              ← Entidades: Users, Permissions, UserPermissions
│   ├── master-data.cds       ← Entidades: Materials, Addresses, DistributionCenters, Warehouses
│   ├── inventory.cds         ← Entidades: Stocks, Moviments, StockHistory
│   └── index.cds             ← Agregador de todos os namespaces
│
└── app/logestoque/
    ├── annotations.cds       ← Anotações Fiori Elements (UI.LineItem, UI.Facets, etc.)
    └── webapp/
        ├── Component.ts      ← Injeta Bearer token no modelo OData
        ├── manifest.json     ← Rotas SPA
        ├── view/             ← Views XML (Login, EstoqueDashboard — freestyle)
        └── controller/       ← Controllers TypeScript
```

---

## 5. Camada de Dados

### 5.1 Namespaces CDS

| Namespace | Arquivo | Entidades |
|---|---|---|
| `db.types` | `db/types.cds` | `MovimentTypes`, `MovimentStatus` (enums) |
| `db.auth` | `db/auth.cds` | `Users`, `Permissions`, `UserPermissions` |
| `db.masterdata` | `db/master-data.cds` | `Materials`, `Addresses`, `DistributionCenters`, `Warehouses` |
| `db.inventory` | `db/inventory.cds` | `Stocks`, `Moviments`, `StockHistory` |

### 5.2 Relacionamentos Principais

```
DistributionCenters (1) ──── (N) Warehouses       [Composition]
DistributionCenters (1) ──── (1) Addresses         [Association]
Warehouses          (1) ──── (N) Stocks            [Association from Stocks]
Materials           (1) ──── (N) Stocks            [Association from Stocks]
Materials           (1) ──── (N) Moviments         [Association from Moviments]
Warehouses          (1) ──── (N) Moviments         [como originWarehouse]
Warehouses          (1) ──── (N) Moviments         [como destinationWarehouse]
Moviments           (1) ──── (N) StockHistory      [Composition]
Stocks              (1) ──── (N) StockHistory      [Association from StockHistory]
Users               (1) ──── (N) UserPermissions   [Composition]
Permissions         (1) ──── (N) UserPermissions   [Association from UserPermissions]
```

**Regra:** `Composition of many` onde o filho não existe sem o pai. `Association to one` para referências navegacionais.

### 5.3 Estratégia de Consistência

- **ACID** via transações PostgreSQL (`db.transaction(async tx => { ... })`)
- A conclusão de movimentação roda em transação atômica: atualiza `Stocks` + cria `StockHistory` + muda status
- CAP usa queries parametrizadas automaticamente (proteção contra SQL injection)

---

## 6. Camada de Serviços OData

### 6.1 `MainService` — `/odata/v4/main`

- **Audiência:** UI Fiori Elements
- **Autenticação:** `@requires: 'authenticated-user'`
- **Entidades expostas (read-only):** `MovimentByWarehouse`, `MovimentDetail`, `Materials`, `Warehouses`, `DistributionCenters`
- **Ações (bound/unbound):** `criarMovimentacao`, `aprovarMovimentacao`, `rejeitarMovimentacao`, `concluirMovimentacao`
- **Funções:** `posicaoEstoque(materialID)`

### 6.2 `EndpointsService` — `/odata/v4/endpoints`

- **Audiência:** Administração (ferramentas, scripts, UI admin futura)
- **Autenticação:** `@requires: 'ADMIN'`
- **Entidades expostas:** Users (`excluding { password }`), Permissions, Materials, DistributionCenters, Warehouses, Addresses, Stocks, Moviments, StockHistory
- **Ações:** `redefinirSenha(userID, novaSenha)`
- **Restrições:** `StockHistory` imutável (bloqueia CREATE/UPDATE/DELETE); `Moviments` em status C/R bloqueiam UPDATE/DELETE

### 6.3 Endpoints REST — `/auth/*`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/login` | Pública | Gera JWT |
| GET | `/auth/me` | Bearer | Retorna payload do token |
| POST | `/auth/logout` | — | Stateless; retorna 200 |
| GET | `/health` | Pública | Health check (DB + app) |

---

## 7. Fluxo de Autenticação

```
Browser          Nginx           CAP App          PostgreSQL
   │               │                │                 │
   ├─POST /auth/login──────────────►│                 │
   │               │                ├─SELECT Users───►│
   │               │                │◄─user row───────│
   │               │                ├─bcrypt.compare()│
   │               │                ├─jwt.sign()      │
   │◄──{ token }───────────────────◄│                 │
   │               │                │                 │
   ├─GET /odata/v4/main/...         │                 │
   │  Authorization: Bearer <tok>──►│                 │
   │               │                ├─jwt.verify()    │
   │               │                ├─cds.User(roles) │
   │               │                ├─OData handler   │
   │◄──OData JSON──────────────────◄│                 │
```

---

## 8. Decisões Arquiteturais (ADRs Resumidos)

### ADR-01: Autenticação JWT local (sem XSUAA)
- **Decisão:** Implementar `POST /auth/login` com `jsonwebtoken` + `bcrypt`; middleware customizado popula `cds.context.user`
- **Motivo:** Sistema hospedado fora do SAP BTP; sem acesso ao SAP XSUAA
- **Trade-off:** Sem refresh token; sessões expiram em 8h (aceitável para TCC)

### ADR-02: Dois serviços OData separados
- **Decisão:** `MainService` (UI) e `EndpointsService` (admin) com autorização diferenciada
- **Motivo:** Separação de concerns; EndpointsService restrito a ADMIN sem expor internals à UI

### ADR-03: PostgreSQL via `@cap-js/postgres` + SQLite para dev
- **Decisão:** Profile `[production]` usa PostgreSQL; `[development]` usa SQLite in-memory
- **Motivo:** Paridade com produção sem necessidade de PostgreSQL local no desenvolvimento

### ADR-04: Sem dependência circular no modelo CDS
- **Decisão:** `master-data.cds` não importa `inventory.cds`; backlinks de `Warehouses → Stocks` acessadas via OData `$expand`
- **Motivo:** Dependência circular causa erros em versões estritas do CDS

### ADR-05: Fiori Elements como padrão de UI
- **Decisão:** Usar exclusivamente List Report + Object Page via anotações CDS; freestyle apenas para Login e Dashboard de Estoque
- **Motivo:** Conformidade com padrões SAP Fiori; manutenibilidade e consistência de UX
