#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { join, basename } = require('node:path');

const DATA_DIR = join(__dirname, '..', 'test', 'data');

// Insertion order respects FK dependencies
// @cap-js/postgres cria todas as tabelas em lowercase
const INSERT_ORDER = [
  'sap_common_countries',
  'sap_common_countries_texts',
  'db_auth_permissions',
  'db_masterdata_addresses',
  'db_auth_users',
  'db_masterdata_distributioncenters',
  'db_masterdata_warehouses',
  'db_masterdata_materials',
  'db_auth_userpermissions',
  'db_inventory_stocks',
  'db_inventory_moviments',
  'db_inventory_stockhistory',
];

function csvFilename2Table(file) {
  return basename(file, '.csv').replace(/[.-]/g, '_').toLowerCase();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return headers.map((_, i) => {
      const val = values[i] ?? '';
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (val === '') return null;
      return val;
    });
  });
  return { headers, rows };
}

async function seed() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  console.log(`Conectado em ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`);

  try {
    // Truncate in reverse insertion order
    const truncateList = [...INSERT_ORDER].reverse().map(t => `"${t}"`).join(', ');
    console.log('Limpando tabelas...');
    await client.query(`TRUNCATE TABLE ${truncateList} CASCADE`);

    // Build CSV map: tableName -> { headers, rows }
    const allFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
    const csvMap = {};
    for (const file of allFiles) {
      const table = csvFilename2Table(file);
      csvMap[table] = parseCSV(readFileSync(join(DATA_DIR, file), 'utf8'));
    }

    // Insert in dependency order
    for (const table of INSERT_ORDER) {
      const data = csvMap[table];
      if (!data || data.rows.length === 0) continue;

      const { headers, rows } = data;
      const colList = headers.map(h => `"${h.toLowerCase()}"`).join(', ');
      const placeholders = rows.map((_, ri) =>
        `(${headers.map((_, ci) => `$${ri * headers.length + ci + 1}`).join(', ')})`
      ).join(', ');
      const values = rows.flat();

      console.log(`Inserindo ${rows.length} linhas em "${table}"...`);
      await client.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${placeholders}`,
        values
      );
    }

    console.log('\nSeed concluído com sucesso!');
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error('\nErro no seed:', err.message);
  process.exit(1);
});
