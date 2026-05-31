# Technology Stack — LogEstoque

> Stack alinhada às melhores práticas SAP para projetos CAP fora do BTP.

---

## 1. Backend

| Componente | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| **Runtime** | Node.js | 20 LTS | Versão estável suportada pelo `@sap/cds` v9 |
| **Framework principal** | SAP Cloud Application Programming Model (`@sap/cds`) | v9 | Padrão SAP para backends OData; gera schema, serviços e handlers |
| **CLI de desenvolvimento** | `@sap/cds-dk` | v9 | `cds watch`, `cds compile`, `cds deploy` |
| **Adaptador PostgreSQL** | `@cap-js/postgres` | v2 | Adaptador oficial CAP para PostgreSQL |
| **Adaptador SQLite (dev)** | `@cap-js/sqlite` | v2 | Banco em memória para desenvolvimento local sem infraestrutura |
| **Autenticação** | `jsonwebtoken` | v9 | Geração e verificação de JWT (HS256) |
| **Hash de senhas** | `bcryptjs` | v3 | Hash bcrypt com custo 10; implementação pure JS (sem dependências nativas) |

### 1.1 Estrutura de pacotes npm

```
LogEstoque/ (workspace raiz)
├── package.json          ← dependências do CAP e scripts npm
└── app/logestoque/
    └── package.json      ← dependências do app UI5
```

### 1.2 Scripts npm principais

```json
{
  "scripts": {
    "start":            "cds-serve",
    "dev":              "cds watch",
    "watch-logestoque": "cds watch --open br.dev.imlucas.logestoque/index.html?sap-ui-xx-viewCache=false --livereload false",
    "test":             "node --test"
  }
}
```

---

## 2. Frontend

| Componente | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| **Framework UI** | SAPUI5 / SAP Fiori Elements | 1.148.x | Padrão SAP para Fiori; `sap.fe.templates` gera UI via anotações CDS |
| **Template principal** | `sap.fe.templates.ListReport` | — | Lista com filtros para `MovimentByWarehouse` |
| **Template secundário** | `sap.fe.templates.ObjectPage` | — | Detalhes de movimentação e histórico |
| **Linguagem** | TypeScript | ~5.x | Transpilado via `ui5-tooling-transpile` |
| **Tema** | `sap_horizon` | — | Tema Fiori Horizon (mais recente) |
| **Tooling** | `@ui5/cli` + `ui5-tooling-transpile` | — | Build e serve do app UI5 |
| **Integração CAP↔UI5** | `cds-plugin-ui5` | — | Serve o app UI5 diretamente pelo servidor CAP em desenvolvimento |

### 2.1 Estratégia UI

- **Fiori Elements** para telas de negócio (movimentações): controladas inteiramente por anotações CDS em `app/logestoque/annotations.cds`
- **Freestyle** (XML View + Controller TypeScript) apenas para:
  - Tela de Login (`webapp/view/Login.view.xml`)
  - Dashboard de Posição de Estoque (`webapp/view/EstoqueDashboard.view.xml`)

### 2.2 Gerenciamento de estado

- **Modelo OData v4** (`sap.ui.model.odata.v4.ODataModel`): estado principal gerenciado pelo framework
- **JSONModel**: estado local das views freestyle (login form, filtros do dashboard)
- Token JWT armazenado em `sessionStorage` (escopo de sessão do browser)

---

## 3. Banco de Dados

| Ambiente | Banco | Configuração |
|---|---|---|
| **Produção** | PostgreSQL 16 Alpine | Container Docker; credenciais via variáveis de ambiente |
| **Desenvolvimento** | SQLite in-memory | `@cap-js/sqlite`; carrega CSVs de `test/data/` automaticamente |
| **Testes** | SQLite in-memory | Profile `[testing]` no `cds.requires` |

### 3.1 Configuração por perfil (`package.json`)

```json
{
  "cds": {
    "requires": {
      "db": {
        "[production]": {
          "kind": "postgres",
          "credentials": {
            "host":     { "from": "env", "name": "DB_HOST" },
            "port":     { "from": "env", "name": "DB_PORT", "as": "number" },
            "database": { "from": "env", "name": "DB_NAME" },
            "user":     { "from": "env", "name": "DB_USER" },
            "password": { "from": "env", "name": "DB_PASSWORD" }
          }
        },
        "[development]": {
          "kind": "sqlite",
          "credentials": { "url": ":memory:" }
        }
      },
      "auth": {
        "kind": "custom",
        "impl": "./srv/auth/auth-middleware"
      }
    },
    "server": {
      "cors": {
        "[production]": false,
        "[development]": true
      }
    },
    "[testing]": {
      "requires": {
        "db": {
          "kind": "sqlite",
          "credentials": { "url": ":memory:" }
        }
      }
    }
  }
}
```

---

## 4. Comunicação e Integração

| Protocolo | Uso |
|---|---|
| **OData v4** | Comunicação UI5 ↔ CAP (`/odata/v4/main`, `/odata/v4/endpoints`) |
| **REST/JSON** | Autenticação (`/auth/login`, `/auth/me`, `/auth/logout`), health check (`/health`) |
| **HTTP/2 (via Nginx)** | Browser ↔ Nginx |
| **HTTP/1.1** | Nginx ↔ CAP (proxy interno) |

**Headers de autenticação:** `Authorization: Bearer <JWT>` em todas as requisições OData e REST protegidas.

---

## 5. Infraestrutura e Ferramentas

| Componente | Tecnologia | Versão |
|---|---|---|
| **Proxy/TLS** | Nginx | Alpine (latest) |
| **Containerização** | Docker + Docker Compose | v2+ |
| **Orquestração** | Docker Compose (single-node) | — |
| **CI/CD** | Manual (para TCC) | — |
| **VCS** | Git | — |

---

## 6. Ferramentas de Desenvolvimento

| Ferramenta | Uso |
|---|---|
| `cds watch` | Hot-reload do servidor CAP em desenvolvimento (SQLite) |
| `cds compile` | Validação estática dos arquivos `.cds` |
| `cds deploy` | Aplica schema no banco (desenvolvimento e produção) |
| `ui5 build` | Build do app Fiori para produção |
| REST Client (VS Code) | Testes manuais via arquivos `.http` |
| `node --test` | Test runner nativo do Node.js (sem dependências externas) |

---

## 7. Dependências Completas

### 7.1 `package.json` raiz — `dependencies`

```json
{
  "@cap-js/postgres": "^2",
  "@sap/cds": "^9",
  "bcryptjs": "^3.0.3",
  "jsonwebtoken": "^9"
}
```

### 7.2 `package.json` raiz — `devDependencies`

```json
{
  "@cap-js/cds-test": "^0",
  "@cap-js/sqlite": "^2",
  "@sap/cds-dk": "^9",
  "@types/jsonwebtoken": "^9"
}
```

### 7.3 `app/logestoque/package.json` — `devDependencies`

```json
{
  "@ui5/cli": "^4",
  "ui5-tooling-transpile": "^3",
  "cds-plugin-ui5": "^1"
}
```

### 7.4 Workspace npm

O projeto usa npm workspaces para gerenciar o app UI5 como sub-pacote:

```json
{
  "workspaces": ["app/*"],
  "sapux": ["app/logestoque"]
}
```
