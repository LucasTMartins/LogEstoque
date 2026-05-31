# Testing — LogEstoque

> Estratégia de testes baseada no test pyramid do Node.js nativo (`node:test`), sem dependências externas de test runner.

---

## 1. Pirâmide de Testes

```
        ┌───────────────┐
        │  E2E/Smoke    │  ← Arquivos .http (manuais)
        │   (Manual)    │
      ┌─┴───────────────┴─┐
      │    Integração      │  ← @cap-js/cds-test + SQLite
      │  (Automatizados)   │
    ┌─┴────────────────────┴─┐
    │       Unitários         │  ← node:test + funções puras
    │    (Automatizados)      │
    └────────────────────────┘
```

| Camada | Ferramenta | Escopo | Meta de Cobertura |
|---|---|---|---|
| **Unitária** | `node:test` + `node:assert/strict` | Handlers, utils, regras de negócio | ≥ 80% das funções puras |
| **Integração** | `@cap-js/cds-test` (SQLite in-memory) | Endpoints OData, autenticação, fluxos de movimentação | Casos de uso críticos 100% |
| **E2E/Smoke** | Arquivos `.http` (REST Client) | Fluxo completo login → movimentação → conclusão | Manual antes de cada deploy |

---

## 2. Estrutura de Arquivos

```
test/
├── data/                          ← CSVs carregados automaticamente em dev/test
│   ├── db.auth-Users.csv
│   ├── db.auth-Permissions.csv
│   ├── db.auth-UserPermissions.csv
│   ├── db.masterdata-Materials.csv
│   ├── db.masterdata-Addresses.csv
│   ├── db.masterdata-DistributionCenters.csv
│   ├── db.masterdata-Warehouses.csv
│   ├── db.inventory-Stocks.csv
│   ├── db.inventory-Moviments.csv
│   ├── db.inventory-StockHistory.csv
│   └── sap.common-Countries.csv
│
├── unit/
│   ├── auth-utils.test.js         ← Testes JWT e bcrypt (funções puras)
│   └── moviment-rules.test.js     ← Testes de regras de negócio
│
├── integration/
│   ├── auth.test.js               ← Testes do endpoint /auth/* e middleware
│   ├── moviments.test.js          ← Testes do fluxo completo de movimentações
│   └── endpoints.test.js          ← Testes do EndpointsService
│
└── http/
    ├── auth.http                  ← Login, me, logout
    ├── moviments.http             ← CRUD e ações de movimentação
    ├── distribution-centers.http  ← CRUD de CDs
    └── users.http                 ← CRUD de usuários (admin)
```

---

## 3. Testes Unitários

### 3.1 Cobertura por módulo

| Arquivo | Módulo testado | Casos |
|---|---|---|
| `test/unit/auth-utils.test.js` | `srv/auth/jwt.js` (JWT sign/verify) | Token válido, inválido, expirado, assinatura adulterada |
| `test/unit/moviment-rules.test.js` | `srv/moviment-rules.js` | Todas as combinações de tipo × campos obrigatórios; quantidade mínima |

### 3.2 Exemplo: `test/unit/auth-utils.test.js`

```javascript
// Definir JWT_SECRET antes de importar (jwt.js lança erro se ausente)
process.env.JWT_SECRET = 'test-secret-para-auth-utils-tests-32chars!!'

const { test } = require('node:test')
const assert   = require('node:assert/strict')
const jwt      = require('../../srv/auth/jwt')

test('signToken retorna string JWT válida', () => {
    const token = jwt.signToken({ username: 'test', roles: ['ESTOQUE'] })
    assert.ok(token.split('.').length === 3)
})

test('verifyToken decodifica payload corretamente', () => {
    const token   = jwt.signToken({ username: 'joao.silva', roles: ['ESTOQUE'] })
    const decoded = jwt.verifyToken(token)
    assert.equal(decoded.username, 'joao.silva')
})

test('verifyToken lança erro para token inválido', () => {
    assert.throws(() => jwt.verifyToken('token.invalido.aqui'))
})
```

### 3.3 Exemplo: `test/unit/moviment-rules.test.js`

```javascript
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { validateMoviment } = require('../../srv/moviment-rules')

describe('Regras de Movimentação', () => {
    test('Entrada deve ter destinationWarehouse', () => {
        const r = validateMoviment({ type: 'E', quantity: 10, destinationWarehouseID: null })
        assert.ok(r.error)
        assert.match(r.error, /destino/)
    })

    test('Saída deve ter originWarehouse', () => {
        const r = validateMoviment({ type: 'S', quantity: 5, originWarehouseID: null })
        assert.ok(r.error)
        assert.match(r.error, /origem/)
    })

    test('Quantidade deve ser maior que zero', () => {
        const r = validateMoviment({ type: 'E', quantity: 0, destinationWarehouseID: 'wh-123' })
        assert.ok(r.error)
        assert.match(r.error, /quantidade/i)
    })

    test('Movimentação válida retorna sem erro', () => {
        const r = validateMoviment({ type: 'E', quantity: 10, destinationWarehouseID: 'wh-123' })
        assert.equal(r.error, null)
    })
})
```

**Requisito:** A lógica de validação deve ser extraída para `srv/moviment-rules.js` como funções puras (sem dependência do CDS).

---

## 4. Testes de Integração

### 4.1 Infraestrutura

`@cap-js/cds-test` inicia o servidor CAP completo com SQLite in-memory e carrega os CSVs de `test/data/`. Não requer PostgreSQL nem processo externo.

**Profile de teste** (em `package.json`):
```json
{
  "cds": {
    "[testing]": {
      "requires": {
        "db": { "kind": "sqlite", "credentials": { "url": ":memory:" } },
        "auth": { "kind": "custom", "impl": "./srv/auth/auth-middleware" }
      }
    }
  }
}
```

### 4.2 Casos críticos — `test/integration/moviments.test.js`

| Teste | Validação |
|---|---|
| GET `MovimentByWarehouse` com token válido | Status 200; `value` é array |
| POST em `Moviments` com dados válidos | Status 201; movimentação criada com status `P` |
| POST em `Moviments` sem `destinationWarehouse` para tipo E | Status 4xx |
| `approve` (APROVACAO) → `conclude` (ESTOQUE) | Estoque atualizado; status `C` |
| Editar movimentação com status `C` | Status 409 |
| GET sem token | Status 401 |
| Acesso ao `EndpointsService` com role `ESTOQUE` | Status 403 |

### 4.3 Casos críticos — `test/integration/auth.test.js`

| Teste | Validação |
|---|---|
| Login com credenciais corretas | Status 200; token JWT retornado |
| Login com senha errada | Status 401 |
| Login com usuário inativo | Status 401 (resposta genérica — não revela existência do usuário) |
| `GET /auth/me` com token válido | Status 200; `username` correto |
| `GET /auth/me` sem token | Status 401 |

---

## 5. Testes E2E / Smoke (Manuais)

Executar com a extensão **REST Client** do VS Code antes de cada deploy para produção.

### Fluxo crítico a validar

```
1. POST /auth/login          → token JWT
2. GET  /odata/v4/main/MovimentByWarehouse  → lista
3. POST /odata/v4/main/Moviments                              → movimentação P
4. POST /odata/v4/main/Moviments(ID)/MainService.approve      → status A
5. POST /odata/v4/main/Moviments(ID)/MainService.conclude     → status C; estoque atualizado
7. POST /auth/login (senha errada)          → 401
8. GET  /odata/v4/endpoints/Users (sem ADMIN) → 403
```

---

## 6. Análise Estática

| Ferramenta | Uso |
|---|---|
| `npx cds compile db/` | Valida todos os arquivos `.cds` (erros de modelo) |
| `npx cds compile srv/` | Valida serviços OData (tipos, projeções, ações) |
| TypeScript compiler (`tsc`) | Valida controllers UI5 via `ui5-tooling-transpile` |

**Integrar no workflow de desenvolvimento:**
```bash
# Antes de cada commit
npx cds compile db/ && npx cds compile srv/
npm test
```

---

## 7. Executar Testes

```bash
# Todos os testes
npm test

# Apenas unitários
node --test test/unit/

# Apenas integração
node --test test/integration/

# Com output detalhado
node --test --reporter=spec test/**/*.test.js

# Cobertura (Node.js 22+)
node --test --experimental-test-coverage test/**/*.test.js
```

---

## 8. Dados de Teste

Os CSVs em `test/data/` são carregados automaticamente pelo CAP em desenvolvimento e testes.

**Atenção sobre senhas:**
- Os CSVs em `test/data/` usam hashes bcrypt (custo 10) — **não** texto puro
- A senha padrão de todos os usuários de teste é `pass-01`
- Em produção (seed.sql), **sempre** usar hashes bcrypt

**IDs nos CSVs:**
- Usar UUIDs fixos nos CSVs para que os testes de integração possam referenciar IDs conhecidos
- Ex.: `materialID: '20157005-d245-412e-bbef-ba3d5f84d175'` nos testes de movimentação

---

## 9. Qualidade — Gates Mínimos

| Gate | Requisito |
|---|---|
| `cds compile` | Zero erros ou warnings de dependência circular |
| Testes unitários | 100% dos testes passando |
| Testes de integração | 100% dos casos críticos passando |
| Smoke test manual | Fluxo completo funcional antes de cada deploy |
