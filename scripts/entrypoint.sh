#!/bin/sh
set -e

MAX_RETRIES=30
RETRY_INTERVAL=2

echo "Aguardando PostgreSQL em $DB_HOST:$DB_PORT..."

i=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do
    i=$((i + 1))
    if [ "$i" -ge "$MAX_RETRIES" ]; then
        echo "Erro: PostgreSQL não respondeu após $MAX_RETRIES tentativas."
        exit 1
    fi
    echo "Tentativa $i/$MAX_RETRIES — aguardando $RETRY_INTERVAL segundos..."
    sleep "$RETRY_INTERVAL"
done

echo "PostgreSQL disponível. Executando cds deploy..."
node node_modules/@sap/cds/bin/deploy.js \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --database "$DB_NAME" \
  --user "$DB_USER" \
  --password "$DB_PASSWORD"
echo "Iniciando aplicação..."
exec node node_modules/@sap/cds/bin/serve.js
