#!/usr/bin/env node
/**
 * Inventário local verificável por SHA-256, separado por loja.
 * Só inspeciona exportações já existentes; não acessa banco/bucket remoto.
 * Não considera exportação "completa" apenas porque os hashes conferem.
 */
import { createReadStream, promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, join, sep, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = 'mb-export-inventory-v1';
const STORES = new Set(['mb-dryfit', 'mb-for-her']);
const MANIFEST = 'manifesto.json';
const MAX_FILES = 1000000;

function assertStore(store) {
  if (!STORES.has(store)) throw Error('Loja inválida: mb-dryfit ou mb-for-her.');
}
function assertSafePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') || path.split('/').some(s => !s || s === '.' || s === '..' || s === '.git')) {
    throw Error('Caminho relativo inseguro no inventário.');
  }
}
async function sha256(file) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function inventory(root) {
  const st = await fs.lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) throw Error('A origem deve ser uma pasta real.');
  const result = [], seen = new Set();
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      if (item.name === '.git') throw Error('Repositórios .git não pertencem ao backup.');
      const abs = join(dir, item.name);
      if (item.isSymbolicLink()) throw Error('Link simbólico proibido: ' + item.name);
      if (item.isDirectory()) await walk(abs);
      else if (item.isFile()) {
        const rel = relative(root, abs).split(sep).join('/');
        if (rel === MANIFEST) continue;
        assertSafePath(rel);
        const folded = rel.toLocaleLowerCase('en-US');
        if (seen.has(folded)) throw Error('Caminhos duplicados em sistema sem distinção de maiúsculas: ' + rel);
        seen.add(folded);
        const st = await fs.stat(abs);
        if (result.length >= MAX_FILES) throw Error('Quantidade de arquivos acima do limite operacional.');
        result.push({ path: rel, bytes: st.size, sha256: await sha256(abs) });
      } else throw Error('Tipo de arquivo proibido: ' + item.name);
    }
  }
  await walk(root);
  result.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return result;
}
function coverage(files) {
  // Contagens locais != comprovação de que todos os dados do serviço remoto foram exportados.
  const count = prefix => files.filter(f => f.path.startsWith(prefix)).length;
  return { d1_files: count('d1/'), r2_files: count('r2/'), code_files: count('codigo/'), total_files: files.length };
}
function formatMismatch(reason) { throw Error('Inventário divergente: ' + reason); }

export async function createManifest(store, rootArg) {
  assertStore(store);
  const root = resolve(rootArg);
  const files = await inventory(root);
  if (!files.length) throw Error('A pasta de exportação está vazia.');
  const manifest = {
    format: FORMAT,
    store,
    created_at: new Date().toISOString(),
    coverage: coverage(files),
    completeness: 'NOT_VERIFIED',
    note: 'Hashes verificam os arquivos locais; a completude do D1 e R2 precisa de inventário remoto e restauração isolada.',
    files
  };
  const path = join(root, MANIFEST);
  await fs.writeFile(path, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest;
}
export async function verifyManifest(store, rootArg) {
  assertStore(store);
  const root = resolve(rootArg);
  const manifestPath = join(root, MANIFEST);
  const st = await fs.lstat(manifestPath);
  if (!st.isFile() || st.isSymbolicLink() || st.size > 100 * 1024 * 1024) throw Error('Manifesto inválido.');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.format !== FORMAT || manifest.store !== store || manifest.completeness !== 'NOT_VERIFIED') formatMismatch('loja, formato ou estado.');
  if (!Array.isArray(manifest.files) || manifest.files.length > MAX_FILES) formatMismatch('estrutura dos arquivos.');
  const actual = await inventory(root);
  if (actual.length !== manifest.files.length) formatMismatch('quantidade de arquivos.');
  for (let i = 0; i < actual.length; i++) {
    const file = manifest.files[i];
    assertSafePath(file?.path);
    if (actual[i].path !== file.path || actual[i].bytes !== file.bytes || actual[i].sha256 !== file.sha256) {
      formatMismatch('conteúdo ou hash do arquivo ' + actual[i].path);
    }
  }
  if (JSON.stringify(coverage(actual)) !== JSON.stringify(manifest.coverage)) formatMismatch('contagens.');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, store, directory] = process.argv.slice(2);
  try {
    if (!directory) throw Error('Uso: create|verify LOJA PASTA_EXPORTADA');
    if (command === 'create') {
      const result = await createManifest(store, directory);
      console.log('Inventário criado para ' + result.store + ': ' + result.files.length + ' arquivos. Completude remota NÃO verificada.');
    } else if (command === 'verify') {
      const result = await verifyManifest(store, directory);
      console.log('Inventário SHA-256 válido para ' + result.store + ': ' + result.files.length + ' arquivos. Completude remota NÃO verificada.');
    } else throw Error('Uso: create|verify LOJA PASTA_EXPORTADA');
  } catch (error) {
    console.error('ERRO: ' + error.message);
    process.exitCode = 1;
  }
}
