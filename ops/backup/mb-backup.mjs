#!/usr/bin/env node
/**
 * Empacotador local de backups cifrados, separado por loja.
 * NÃO exporta D1/R2 automaticamente e NÃO acessa produção.
 * Node.js >= 24 e tar no PATH. Apenas arquivos previamente exportados.
 */
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { resolve, sep, dirname } from 'node:path';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('MBBACK01');
const HEADER_SIZE = MAGIC.length + 1 + 16 + 12;
const TAG_SIZE = 16;
const IDS = new Map([['mb-dryfit', 1], ['mb-for-her', 2]]);
const NAMES = new Map([[1, 'mb-dryfit'], [2, 'mb-for-her']]);

function keyFromEnv(salt) {
  const pass = process.env.MB_BACKUP_PASSPHRASE;
  if (typeof pass !== 'string' || pass.length < 16) {
    throw new Error('Defina MB_BACKUP_PASSPHRASE com pelo menos 16 caracteres, fora do chat e do Git.');
  }
  return scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function checkInput(root) {
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('A entrada deve ser uma pasta real.');
  let total = 0;
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Links simbólicos são proibidos no backup: ' + full);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) total++;
      else throw new Error('Tipo de arquivo não permitido: ' + full);
    }
  }
  await walk(root);
  if (!total) throw new Error('A pasta de exportação está vazia.');
  return total;
}

async function exitStatus(child, label) {
  const [code, signal] = await once(child, 'close');
  if (code !== 0) throw new Error(label + ' falhou (' + (signal || code) + ').');
}

function tarProcess(args) {
  return spawn('tar', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '' }
  });
}

async function pack(store, inputArg, outputArg) {
  if (!IDS.has(store)) throw new Error('Loja inválida: use mb-dryfit ou mb-for-her.');
  if (!inputArg || !outputArg) throw new Error('Uso: pack LOJA PASTA_EXPORTADA ARQUIVO.mbbackup');
  const input = resolve(inputArg);
  const output = resolve(outputArg);
  if (output === input || output.startsWith(input + sep)) throw new Error('O backup deve ficar fora da pasta de entrada.');
  const fileCount = await checkInput(input);
  await fs.mkdir(dirname(output), { recursive: true });

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = keyFromEnv(salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const header = Buffer.concat([MAGIC, Buffer.from([IDS.get(store)]), salt, iv]);
  const tar = tarProcess(['-C', input, '-cf', '-', '.']);
  tar.stdin.end();
  let tarError = '';
  tar.stderr.on('data', (chunk) => { tarError = (tarError + chunk.toString()).slice(-1000); });

  async function* encrypted() {
    yield header;
    for await (const chunk of tar.stdout) {
      const part = cipher.update(chunk);
      if (part.length) yield part;
    }
    const last = cipher.final();
    if (last.length) yield last;
    yield cipher.getAuthTag();
  }
  try {
    await pipeline(Readable.from(encrypted()), createWriteStream(output, { flags: 'wx', mode: 0o600 }));
    await exitStatus(tar, 'tar');
    console.log('Backup local cifrado criado: ' + store + ' (' + fileCount + ' arquivos).');
    console.log('Arquivo: ' + output);
    if (tarError) console.warn('Aviso tar: ' + tarError);
  } catch (error) {
    tar.kill();
    await fs.rm(output, { force: true });
    throw error;
  }
}

async function inspect(archiveArg) {
  const archive = resolve(archiveArg);
  const stat = await fs.stat(archive);
  if (stat.size <= HEADER_SIZE + TAG_SIZE) throw new Error('Arquivo incompleto.');
  const handle = await fs.open(archive, 'r');
  const header = Buffer.alloc(HEADER_SIZE);
  const tag = Buffer.alloc(TAG_SIZE);
  try {
    await handle.read(header, 0, HEADER_SIZE, 0);
    await handle.read(tag, 0, TAG_SIZE, stat.size - TAG_SIZE);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Formato de backup inválido.');
  const store = NAMES.get(header[8]);
  if (!store) throw new Error('Identificador de loja inválido.');
  const salt = header.subarray(9, 25);
  const iv = header.subarray(25, 37);
  const key = keyFromEnv(salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  async function* decrypted() {
    for await (const chunk of createReadStream(archive, {
      start: HEADER_SIZE, end: stat.size - TAG_SIZE - 1
    })) {
      const part = decipher.update(chunk);
      if (part.length) yield part;
    }
    const last = decipher.final(); // Rejeita senha errada ou arquivo adulterado
    if (last.length) yield last;
  }
  return { store, decrypted };
}

async function verify(archive) {
  const { store, decrypted } = await inspect(archive);
  const tar = tarProcess(['-tf', '-']);
  let tarError = '';
  tar.stdout.resume();
  tar.stderr.on('data', (chunk) => { tarError = (tarError + chunk.toString()).slice(-1000); });
  try {
    await pipeline(Readable.from(decrypted()), tar.stdin);
    await exitStatus(tar, 'Verificação do tar');
    console.log('Backup cifrado íntegro e TAR legível: ' + store);
  } catch (error) {
    tar.kill();
    throw new Error('Backup rejeitado: ' + (tarError || error.message));
  }
}

async function unpack(archive, targetArg) {
  if (!targetArg) throw new Error('Uso: unpack ARQUIVO.mbbackup SAIDA.tar');
  const { store, decrypted } = await inspect(archive);
  const target = resolve(targetArg);
  if (target === resolve(archive)) throw new Error('A saída não pode sobrescrever o backup.');
  try {
    await pipeline(Readable.from(decrypted()), createWriteStream(target, { flags: 'wx', mode: 0o600 }));
    const listing = tarProcess(['-tf', target]);
    listing.stdin.end();
    listing.stdout.resume();
    listing.stderr.resume();
    await exitStatus(listing, 'Verificação do tar restaurado');
    console.log('Arquivo TAR recuperado e validado para ' + store + ': ' + target);
    console.log('Inspecione-o antes da extração em ambiente isolado. Nenhum banco foi alterado.');
  } catch (error) {
    await fs.rm(target, { force: true });
    throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'pack') await pack(...args);
  else if (command === 'verify' && args.length === 1) await verify(args[0]);
  else if (command === 'unpack' && args.length === 2) await unpack(...args);
  else throw new Error('Uso:\n  pack LOJA PASTA_EXPORTADA SAIDA.mbbackup\n  verify ARQUIVO.mbbackup\n  unpack ARQUIVO.mbbackup SAIDA.tar');
}
main().catch((error) => {
  console.error('ERRO: ' + error.message);
  process.exitCode = 1;
});
