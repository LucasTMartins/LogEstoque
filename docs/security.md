# Security — LogEstoque

> Planejamento de segurança seguindo OWASP Top 10 e melhores práticas SAP.

---

## 1. Autenticação

### 1.1 Mecanismo

- **Protocolo:** JWT (JSON Web Token), algoritmo HS256
- **Endpoint:** `POST /auth/login` — implementado em Node.js via `cds.on('bootstrap', ...)`
- **Fluxo:**
  1. Recebe `username` + `password`
  2. Busca usuário em `db.auth.Users`; verifica `active === true`
  3. Compara senha com hash bcrypt via `bcryptjs.compare(password, user.passwordHash)`
  4. Gera JWT com payload `{ sub, username, name, permissions, iat, exp }`
  5. Assina com `JWT_SECRET` (variável de ambiente obrigatória)

### 1.2 Configuração do Token

```json
{
  "algorithm": "HS256",
  "expiresIn": "8h",
  "payload": {
    "sub": "<user.ID>",
    "username": "<user.username>",
    "name": "<firstName lastName>",
    "permissions": ["ADMIN", "ESTOQUE"]
  }
}
```

### 1.3 Middleware CAP

O arquivo `srv/auth/auth-middleware.js` intercepta **todas** as requisições:
- Extrai Bearer token do header `Authorization`
- Verifica assinatura e expiração via `jwt.verify(token, JWT_SECRET)`
- Popula `req.user = new cds.User({ id, roles, attr })`
- Em caso de token inválido: não lança erro imediatamente — o CAP rejeita nas rotas com `@requires`

### 1.4 Configuração no CAP

```json
{
  "cds": {
    "requires": {
      "auth": {
        "kind": "custom",
        "impl": "./srv/auth/auth-middleware"
      }
    }
  }
}
```

---

## 2. Autorização (RBAC)

### 2.1 Papéis do Sistema

| Role | Stored in DB | Permissões |
|---|---|---|
| `ADMIN` | `db.auth.Permissions` | Acesso total: `EndpointsService` + `MainService` |
| `ESTOQUE` | `db.auth.Permissions` | `MainService`: criar e concluir movimentações |
| `APROVACAO` | `db.auth.Permissions` | `MainService`: aprovar/rejeitar movimentações |
| `VIEWER` | `db.auth.Permissions` | `MainService`: somente leitura (GET) |
| `LOGISTICA` | `db.auth.Permissions` | `MainService`: consultas e relatórios |
| `authenticated-user` | Builtin CAP | Qualquer usuário com token JWT válido |

### 2.2 Mapeamento de Anotações CDS

```cds
@requires: 'ADMIN'
service EndpointsService { ... }

@requires: 'authenticated-user'
service MainService {
    @requires: 'ESTOQUE'
    action criarMovimentacao(...);

    @requires: 'APROVACAO'
    action aprovarMovimentacao(...);

    @requires: 'ESTOQUE'
    action concluirMovimentacao(...);
}
```

### 2.3 Como o CAP Verifica Roles

O token JWT contém `"permissions": ["ESTOQUE", "APROVACAO"]`. O middleware converte em `roles` do `cds.User`. O CAP então verifica se `cds.context.user.roles` inclui o role exigido pela anotação `@requires`.

---

## 3. Proteção de Dados

### 3.1 Senhas

- **Armazenamento:** Hash bcrypt com custo 10 (`$2b$10$...`), campo `passwordHash`
- **Geração:** `bcryptjs.hash(password, 10)` nos handlers `before CREATE|UPDATE Users`
- **Verificação:** `bcryptjs.compare(password, hash)`
- **Exposição:** Campo `passwordHash` **nunca** deve aparecer em projeções OData (`EndpointsService` deve excluir o campo)

### 3.2 Criptografia em Trânsito

- **TLS 1.2 e 1.3** habilitados no Nginx (terminação SSL)
- Protocolos desabilitados: SSLv3, TLS 1.0, TLS 1.1
- Certificado: Let's Encrypt (produção) ou self-signed (desenvolvimento)

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers   HIGH:!aNULL:!MD5;
```

### 3.3 Criptografia em Repouso

- Volume PostgreSQL (`pg-data`) no filesystem da VPS; criptografia depende do setup da VPS
- Para TCC: sem criptografia de disco (aceitável); para produção real: criptografar volume ou usar LUKS

### 3.4 PII e LGPD

- Dados pessoais armazenados: `username`, `firstName`, `lastName` (usuários do sistema)
- Sem dados de clientes finais nesta versão
- `createdBy`/`modifiedBy` preenchidos automaticamente pelo CAP com `cds.context.user.id`

---

## 4. Gerenciamento de Secrets

| Secret | Armazenamento | Rotação |
|---|---|---|
| `JWT_SECRET` | Variável de ambiente (`.env`) | Manual; mínimo 32 caracteres |
| `DB_PASSWORD` | Variável de ambiente (`.env`) | Manual |
| `POSTGRES_PASSWORD` | Variável de ambiente (`.env`) | Manual |
| Certificados TLS | `nginx/ssl/` (fora do Git) | Anual (Let's Encrypt: automático) |

**Regras:**
- Arquivo `.env` **nunca** commitado; está no `.gitignore`
- `nginx/ssl/` **nunca** commitado; está no `.dockerignore`
- Commitado apenas `.env.example` com placeholders
- Sem valores default seguros em produção: `JWT_SECRET` sem default válido

---

## 5. Prevenção de Vulnerabilidades (OWASP Top 10)

### A01: Broken Access Control
- **Mitigação:** `@requires` em todos os serviços e ações; `EndpointsService` restrito a `ADMIN`
- **Validação:** Middleware verifica token em cada requisição

### A02: Cryptographic Failures
- **Mitigação:** bcrypt para senhas; TLS 1.2/1.3; JWT HS256
- **Risco residual:** HS256 usa chave simétrica; aceitável para TCC

### A03: Injection (SQL Injection)
- **Mitigação:** CAP usa ORM com queries parametrizadas automaticamente
- **Sem SQL raw** no código da aplicação; todas as queries via CDS APIs (`SELECT`, `INSERT`, `UPDATE`)

### A05: Security Misconfiguration
- **Mitigação:** `server_tokens off` no Nginx; headers de segurança HTTP configurados
- **CORS:** desabilitado em produção (`"[production]": false`)

### A07: Identification and Authentication Failures
- **Mitigação:** bcrypt com custo alto; rate limiting no `/auth/login`; token com expiração
- **Sem refresh token:** para TCC aceitável; em produção implementar sliding sessions

### A09: Security Logging and Monitoring Failures
- **Mitigação básica:** Logs do Nginx (access + error); logs do Node.js via `console.error`
- **Para produção real:** centralizar logs com stack ELK ou similar

---

## 6. Headers de Segurança HTTP (Nginx)

```nginx
# Obrigatórios
add_header X-Frame-Options        "SAMEORIGIN"               always;
add_header X-Content-Type-Options "nosniff"                  always;
add_header X-XSS-Protection       "1; mode=block"            always;
add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
server_tokens off;

# CSP (limitado pelo SAPUI5 que requer unsafe-inline/unsafe-eval)
add_header Content-Security-Policy
  "default-src 'self' https://sapui5.hana.ondemand.com;
   script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sapui5.hana.ondemand.com;
   style-src  'self' 'unsafe-inline' https://sapui5.hana.ondemand.com;
   img-src    'self' data: https:;" always;
```

---

## 7. Rate Limiting

Proteção contra brute force no endpoint de login:

```nginx
# No bloco http
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

# Na rota /auth/login
location /auth/login {
    limit_req        zone=login burst=3 nodelay;
    limit_req_status 429;
    proxy_pass       http://app:4004;
}
```

**Política:** máximo 5 tentativas/minuto por IP; burst de 3 sem atraso.

---

## 8. Proteções Específicas do SAPUI5

- SAPUI5 faz **encode automático** de valores em bindings (`{property}`), prevenindo XSS nos templates Fiori Elements
- Não usar `innerHTML` diretamente em controllers TypeScript
- Não usar `sap.ui.require` para carregar módulos de URLs externas não confiáveis

---

## 9. Checklist de Segurança

### Pré-deploy obrigatório
- [ ] `JWT_SECRET` definido com no mínimo 32 caracteres aleatórios
- [ ] Senhas no banco como bcrypt (nunca texto puro)
- [ ] Campo `passwordHash` excluído das projeções OData
- [ ] `EndpointsService` com `@requires: 'ADMIN'`
- [ ] Arquivo `.env` no `.gitignore`
- [ ] `nginx/ssl/` no `.dockerignore` e `.gitignore`

### Pós-deploy obrigatório
- [ ] Nginx com TLS ativo (certificado válido)
- [ ] Headers de segurança HTTP configurados e verificados
- [ ] Rate limiting no `/auth/login` ativo
- [ ] Senha do usuário `admin` alterada no primeiro login
- [ ] Backup agendado do banco de dados
- [ ] `server_tokens off` no Nginx

### Para TCC (riscos aceitos)
- Sem refresh token (sessões expiram em 8h)
- Sem criptografia de disco
- Sem auditoria de acessos centralizada
- Sem rotação automática de `JWT_SECRET`
