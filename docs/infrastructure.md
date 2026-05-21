# Infrastructure — LogEstoque

> Hospedagem: VPS Linux com Docker Compose (fora do SAP BTP).  
> Modelo: IaaS — instância única, single-node.

---

## 1. Visão Geral da Infraestrutura

```
Internet
    │
    ▼
┌──────────────────────────────────────────────────┐
│  VPS Linux (Ubuntu 22.04 LTS recomendado)        │
│  CPU: ≥ 2 vCPUs  RAM: ≥ 2 GB  Disco: ≥ 20 GB    │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │           Docker Compose                  │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────┐  │   │
│  │  │  nginx   │  │   app     │  │  db    │  │   │
│  │  │ :80/:443 │──│  :4004    │──│ :5432  │  │   │
│  │  │          │  │ CAP+UI5   │  │  PG16  │  │   │
│  │  └──────────┘  └───────────┘  └────────┘  │   │
│  │                                           │   │
│  │  Volumes: pg-data (persistente)           │   │
│  │  Network: logestoque-net (bridge)         │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 2. Serviços Docker

### 2.1 `postgres` — Banco de Dados

| Parâmetro | Valor |
|---|---|
| Imagem | `postgres:16-alpine` |
| Porta | `5432` (interna à rede Docker apenas) |
| Volume | `pg-data:/var/lib/postgresql/data` (persistente) |
| Healthcheck | `pg_isready -U logestoque -d logestoque` |
| Restart | `unless-stopped` |
| Seed | `scripts/seed.sql` → `/docker-entrypoint-initdb.d/01-seed.sql` (primeiro boot) |

### 2.2 `app` — Aplicação CAP + UI5

| Parâmetro | Valor |
|---|---|
| Imagem | Build local (multi-stage Dockerfile) |
| Porta | `4004` (interna à rede Docker apenas) |
| Dependência | `postgres` com `service_healthy` |
| Healthcheck | `GET http://localhost:4004/health` → 200 |
| Restart | `unless-stopped` |
| Entrypoint | `scripts/entrypoint.sh` (aguarda DB, executa `cds deploy`, inicia `cds-serve`) |

### 2.3 `nginx` — Proxy Reverso

| Parâmetro | Valor |
|---|---|
| Imagem | `nginx:alpine` |
| Portas expostas | `80:80`, `443:443` |
| Dependência | `app` com `service_healthy` |
| Config | `./nginx/nginx.conf` (read-only) |
| SSL | `./nginx/ssl/` (cert.pem + key.pem, **não commitados**) |
| Restart | `unless-stopped` |

---

## 3. Dockerfile (Multi-Stage Build)

```dockerfile
# Estágio 1: Builder (instala todas as deps + build opcional do UI5)
FROM node:20-slim AS builder
WORKDIR /build
COPY package*.json ./
COPY app/logestoque/package.json ./app/logestoque/
RUN npm ci
COPY . .
RUN npm run build --workspace=app/logestoque || true

# Estágio 2: Produção (apenas prod deps + artefatos)
FROM node:20-slim AS production
# Dependências nativas para bcrypt
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY app/logestoque/package.json ./app/logestoque/
RUN npm ci --omit=dev
COPY --from=builder /build/app ./app
COPY --from=builder /build/db  ./db
COPY --from=builder /build/srv ./srv
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4004
EXPOSE 4004
ENTRYPOINT ["/entrypoint.sh"]
```

---

## 4. `docker-compose.yml`

```yaml
name: logestoque

services:
  postgres:
    image: postgres:16-alpine
    container_name: logestoque-db
    restart: unless-stopped
    environment:
      POSTGRES_DB:       ${POSTGRES_DB:-logestoque}
      POSTGRES_USER:     ${POSTGRES_USER:-logestoque}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./scripts/seed.sql:/docker-entrypoint-initdb.d/01-seed.sql:ro
    networks: [logestoque-net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-logestoque} -d ${POSTGRES_DB:-logestoque}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  app:
    build: { context: ., dockerfile: dockerfile, target: production }
    container_name: logestoque-app
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      NODE_ENV:     production
      HOST:         0.0.0.0
      PORT:         4004
      JWT_SECRET:   ${JWT_SECRET}
      DB_HOST:      postgres
      DB_PORT:      5432
      DB_NAME:      ${POSTGRES_DB:-logestoque}
      DB_USER:      ${POSTGRES_USER:-logestoque}
      DB_PASSWORD:  ${POSTGRES_PASSWORD}
    networks: [logestoque-net]
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:4004/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  nginx:
    image: nginx:alpine
    container_name: logestoque-proxy
    restart: unless-stopped
    depends_on:
      app: { condition: service_healthy }
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks: [logestoque-net]

volumes:
  pg-data:
    name: logestoque-pg-data

networks:
  logestoque-net:
    name: logestoque-net
    driver: bridge
```

---

## 5. Nginx (`nginx/nginx.conf`)

Pontos-chave da configuração:

- **HTTP → HTTPS redirect** (porta 80 → 443)
- **TLS:** `TLSv1.2 TLSv1.3` apenas; `ssl_session_cache shared:SSL:10m`
- **Proxy:** `proxy_pass http://app:4004` com headers `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
- **Cache de assets UI5:** `.js|.css|.png|...` com `expires 7d; Cache-Control: public, immutable`
- **Compressão:** `gzip on` para JSON, JS, CSS
- **Rate limiting:** zona `login` para `/auth/login` (5 req/min por IP)
- **Tamanho máximo de corpo:** `client_max_body_size 10M`
- **Headers de segurança:** X-Frame-Options, X-Content-Type-Options, HSTS, CSP

---

## 6. Script de Entrypoint (`scripts/entrypoint.sh`)

Executado na inicialização do container `app`:

1. Aguarda PostgreSQL disponível (loop com `pg Client.connect()`)
2. Executa `npx cds deploy --to postgres` (aplica schema)
3. Inicia `cds-serve` com `exec` (substitui o processo shell)

---

## 7. Seed Inicial (`scripts/seed.sql`)

Carregado pelo PostgreSQL na **primeira** inicialização via `docker-entrypoint-initdb.d`:

- 5 permissões básicas: `ADMIN`, `ESTOQUE`, `APROVACAO`, `VIEWER`, `LOGISTICA`
- 1 usuário `admin` com senha bcrypt (hash de `Admin@2024`)
- Vínculo `admin` ↔ `ADMIN`

**Usar `ON CONFLICT DO NOTHING`** para idempotência.

**Atenção:** Os nomes das tabelas no PostgreSQL gerados pelo CAP seguem o padrão `namespace_EntityName` (ex.: `db_auth_Users`). Verificar os nomes reais após o primeiro `cds deploy` com:
```bash
docker exec logestoque-db psql -U logestoque -d logestoque -c "\dt"
```

---

## 8. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `JWT_SECRET` | Sim | Chave JWT (mín. 32 chars aleatórios) |
| `POSTGRES_PASSWORD` | Sim | Senha do banco |
| `POSTGRES_DB` | Não (default: `logestoque`) | Nome do banco |
| `POSTGRES_USER` | Não (default: `logestoque`) | Usuário do banco |
| `DB_HOST` | Auto (via Compose) | Hostname do container PG |
| `DB_PORT` | Não (default: `5432`) | Porta do PG |
| `DB_NAME` | Auto (= `POSTGRES_DB`) | Nome do banco (lido pelo CAP) |
| `DB_USER` | Auto (= `POSTGRES_USER`) | Usuário (lido pelo CAP) |
| `DB_PASSWORD` | Auto (= `POSTGRES_PASSWORD`) | Senha (lida pelo CAP) |
| `NODE_ENV` | Não (default: `development`) | `production` ativa adaptador PG |
| `PORT` | Não (default: `4004`) | Porta do servidor CAP |

**Template:** `.env.example` (commitado); `.env` real **nunca** commitado.

---

## 9. CI/CD

Para o contexto de TCC: **deploy manual**.

### Fluxo de deploy

```bash
# Na VPS, na pasta do projeto
git pull origin main

# Rebuild e restart apenas da aplicação
docker compose up -d --build app

# Verificar saúde
docker compose ps
docker compose logs -f app
```

### Primeiro deploy (setup inicial)

```bash
cp .env.example .env
nano .env                        # Definir JWT_SECRET e POSTGRES_PASSWORD
mkdir -p nginx/ssl
# Copiar certificados TLS ou gerar self-signed:
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -subj "/CN=seu-dominio.com"
docker compose up -d --build
docker compose logs -f app       # Aguardar "server listening on port 4004"
```

---

## 10. Observabilidade

### 10.1 Logs

| Componente | Localização | Acesso |
|---|---|---|
| Nginx (access) | `/var/log/nginx/access.log` dentro do container | `docker logs logestoque-proxy` |
| Nginx (error) | `/var/log/nginx/error.log` | `docker logs logestoque-proxy` |
| CAP (stdout) | stdout do processo Node.js | `docker logs logestoque-app` |
| PostgreSQL | stdout do container | `docker logs logestoque-db` |

### 10.2 Health Check

```
GET /health → { "status": "UP", "db": "UP", "timestamp": "..." }
             ou
             503 { "status": "DOWN", "db": "DOWN", "error": "..." }
```

Docker usa este endpoint para verificar saúde do container `app`.

### 10.3 Métricas (básico — TCC)

- Monitoramento via `docker compose ps` e `docker stats`
- Para produção real: Prometheus + Grafana ou Datadog

---

## 11. Backup e Recuperação

```bash
# Backup manual
docker exec logestoque-db pg_dump -U logestoque logestoque \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauração
docker exec -i logestoque-db psql -U logestoque logestoque \
  < backup_20240101_120000.sql
```

**Recomendado para produção:** cron job diário + retenção de 7 dias.

---

## 12. Atualização de Schema

Após alterar arquivos `.cds`:

```bash
# Opção 1: Reiniciar o container (entrypoint.sh executa cds deploy automaticamente)
docker compose restart app

# Opção 2: Executar deploy manualmente dentro do container
docker exec -it logestoque-app npx cds deploy --to postgres
```

---

## 13. Estrutura de Arquivos de Infraestrutura

```
LogEstoque/
├── dockerfile                    ← Multi-stage build
├── docker-compose.yml            ← Orquestração
├── .dockerignore                 ← Exclui test/, docs/, nginx/ssl/, node_modules
├── .env.example                  ← Template de variáveis (commitado)
├── nginx/
│   ├── nginx.conf                ← Config do Nginx
│   └── ssl/                      ← Certificados TLS (NÃO commitados)
│       ├── cert.pem
│       └── key.pem
└── scripts/
    ├── entrypoint.sh             ← Inicialização do container app
    └── seed.sql                  ← Dados iniciais do banco
```
