# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Instala dependências (incluindo devDeps para o build do CDS)
COPY package*.json ./
COPY app/logestoque/package.json ./app/logestoque/package.json
RUN npm ci

# Copia o código-fonte e compila o CDS para produção
COPY . .
RUN npx cds build --production
# Compila o frontend UI5/TypeScript → dist/ (cds-plugin-ui5 é devDep, não disponível em prod)
RUN cd app/logestoque && npx ui5 build --clean-dest

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-slim AS production

# postgresql-client fornece pg_isready para o entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Apenas dependências de produção (sem devDeps, sem bcrypt nativo — usa bcryptjs)
COPY package*.json ./
COPY app/logestoque/package.json ./app/logestoque/package.json
RUN npm ci --omit=dev

# Artefatos compilados pelo CDS e fontes necessárias em runtime
COPY --from=builder /app/gen ./gen
COPY --from=builder /app/srv ./srv
COPY --from=builder /app/db ./db
# Frontend pré-compilado: copia o dist/ como webapp/ para evitar TypeScript no runtime
COPY --from=builder /app/app/logestoque/dist ./app/logestoque/webapp
COPY --from=builder /app/app/logestoque/annotations.cds ./app/logestoque/annotations.cds
# Fixtures CSV e script de seed usados pelo endpoint /admin/seed
COPY --from=builder /app/scripts/seed-dev.js ./scripts/seed-dev.js
COPY --from=builder /app/test/data ./test/data

# Script de inicialização que aguarda o banco antes de subir
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4004

ENTRYPOINT ["/entrypoint.sh"]
