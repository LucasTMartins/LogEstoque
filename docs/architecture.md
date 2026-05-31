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
│   ├── main.js               ← Handlers das ações de negócio
│   ├── endpoints.cds         ← EndpointsService: CRUD administrativo
│   ├── endpoints.js          ← Handler: hasheia senha em CREATE|UPDATE Users
│   ├── admin.cds             ← AdminService: gestão de usuários (UI admin)
│   ├── admin.js              ← Handler do AdminService
│   ├── moviment-rules.js     ← Funções puras de validação de regras de negócio
│   ├── user-rules.js         ← Funções puras de validação de usuários
│   ├── server.js             ← Bootstrap: registra /auth/* e /health no Express
│   └── auth/
│       ├── auth-middleware.js ← Intercepta requisições, valida JWT, popula cds.context.user
│       ├── login-handler.js   ← REST: POST /auth/login
│       └── jwt.js             ← Utilitários de geração/verificação de token
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
        ├── Component.ts      ← Inicializa modelos JSON de permissões; carrega usuário atual via /odata/v4/main/CurrentUser
        ├── manifest.json     ← Rotas SPA
        ├── login/            ← View XML + Controller do Login (freestyle)
        ├── ext/              ← Custom actions e list controllers (Fiori Elements extensions)
        ├── utils/            ← RequestInterceptor e utilitários
        └── model/            ← userPerms.json e outros modelos estáticos
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

- **ACID** via transações do CAP: em CAP v9, handlers `on()` de actions já rodam dentro de uma transação implícita
- A conclusão de movimentação é atômica: CAP v9 garante que `_updateStock` + `UPDATE Moviments` rodam na mesma transação do handler
- CAP usa queries parametrizadas automaticamente (proteção contra SQL injection)

---

## 6. Camada de Serviços OData

### 6.1 `MainService` — `/odata/v4/main`

- **Audiência:** UI Fiori Elements
- **Autenticação:** `@requires: 'authenticated-user'`
- **Entidades expostas (read-only):** `MovimentByWarehouse`, `MovimentDetail`, `Materials`, `Warehouses`, `DistributionCenters`
- **Ações (bound):** `approve`, `rejectMoviment(reason)`, `conclude`

### 6.2 `EndpointsService` — `/odata/v4/endpoints`

- **Audiência:** Administração (ferramentas, scripts, UI admin futura)
- **Autenticação:** `@requires: 'ADMIN'`
- **Entidades expostas:** Users (exclui `passwordHash`), Permissions, Materials, DistributionCenters, Warehouses, Addresses, Stocks, Moviments, StockHistory
- **Handler:** `srv/endpoints.js` — remove `passwordHash` das respostas via `after READ|CREATE|UPDATE Users` (campo incluído na projeção para escrita, mas nunca exposto em leituras)
- **Restrições:** `StockHistory` imutável (bloqueia CREATE/UPDATE/DELETE); `Moviments` em status C/R bloqueiam UPDATE/DELETE

### 6.3 Endpoints REST — `/auth/*`

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/login` | Pública | Gera JWT |
| GET | `/auth/me` | Bearer | Retorna payload do token |
| POST | `/auth/logout` | — | Limpa cookie `auth_token`; retorna 204 |
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
- **Decisão:** Implementar `POST /auth/login` com `jsonwebtoken` + `bcryptjs`; middleware customizado popula `cds.context.user`
- **Motivo:** Sistema hospedado fora do SAP BTP; sem acesso ao SAP XSUAA
- **Trade-off:** Sem refresh token; sessões expiram em 8h (aceitável para TCC)

### ADR-02: Dois serviços OData separados
- **Decisão:** `MainService` (UI) e `EndpointsService` (admin) com autorização diferenciada
- **Motivo:** Separação de concerns; EndpointsService restrito a ADMIN sem expor internals à UI

### ADR-03: PostgreSQL via `@cap-js/postgres` + SQLite para dev
- **Decisão:** Profile `[production]` usa PostgreSQL; `[development]` usa SQLite in-memory
- **Motivo:** Paridade com produção sem necessidade de PostgreSQL local no desenvolvimento

### ADR-04: Dependências no modelo CDS
- **Decisão:** `master-data.cds` importa `inventory.cds` apenas para a composição `Warehouses.stocks` (backlink navegacional)
- **Motivo:** Necessário para expor `Warehouses` com `stocks` expandidos via OData; o CDS v9 suporta essa importação sem gerar dependência circular real
- **Exceção documentada:** A regra geral de evitar importações entre master-data e inventory é mantida; este é o único caso permitido e justificado

### ADR-05: Fiori Elements como padrão de UI
- **Decisão:** Usar exclusivamente List Report + Object Page via anotações CDS; freestyle apenas para Login e Dashboard de Estoque
- **Motivo:** Conformidade com padrões SAP Fiori; manutenibilidade e consistência de UX
