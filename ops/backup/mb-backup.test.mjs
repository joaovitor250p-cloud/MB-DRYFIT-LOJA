import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const cli = resolve('ops/backup/mb-backup.mjs');
const PASS = 'uma-frase-de-recuperacao-forte-para-testes';
function run(args, password = PASS) {
  return execFileSync(process.execPath, [cli, ...args], {
    env: { ...process.env, MB_BACKUP_PASSPHRASE: password },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30_000
  });
}

test('backups separados cifram, verificam e restauram códigos e fotos', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'mb-backup-test-'));
  try {
    const dry = join(temp, 'dry');
    const her = join(temp, 'her');
    await mkdir(join(dry, 'd1'), { recursive: true });
    await mkdir(join(dry, 'r2', 'imagens'), { recursive: true });
    await mkdir(join(her, 'd1'), { recursive: true });
    await writeFile(join(dry, 'd1', 'produtos.sql'), "INSERT INTO codigos VALUES ('0000000077');\n");
    await writeFile(join(dry, 'r2', 'imagens', 'foto.webp'), Buffer.from([82, 73, 70, 70, 18, 0, 0, 0]));
    await writeFile(join(her, 'd1', 'for-her.sql'), "SELECT 'somente-for-her';\n");

    const dryEncrypted = join(temp, 'dry.mbbackup');
    const herEncrypted = join(temp, 'her.mbbackup');
    assert.match(run(['pack', 'mb-dryfit', dry, dryEncrypted]), /mb-dryfit/);
    assert.match(run(['pack', 'mb-for-her', her, herEncrypted]), /mb-for-her/);
    assert.match(run(['verify', dryEncrypted]), /mb-dryfit/);
    assert.match(run(['verify', herEncrypted]), /mb-for-her/);

    const encrypted = await readFile(dryEncrypted);
    assert.equal(encrypted.includes(Buffer.from('0000000077')), false);
    const resultTar = join(temp, 'dry-recovered.tar');
    run(['unpack', dryEncrypted, resultTar]);
    const extracted = join(temp, 'recovered');
    await mkdir(extracted);
    execFileSync('tar', ['-xf', resultTar, '-C', extracted]);
    assert.match(await readFile(join(extracted, 'd1', 'produtos.sql'), 'utf8'), /0000000077/);
    assert.deepEqual(await readFile(join(extracted, 'r2', 'imagens', 'foto.webp')), Buffer.from([82, 73, 70, 70, 18, 0, 0, 0]));
    await assert.rejects(readFile(join(extracted, 'd1', 'for-her.sql')));

    assert.throws(() => run(['verify', dryEncrypted], 'frase-incorreta-bem-longa'), /Command failed|Status|failed|Error/);
    const corrupt = join(temp, 'corrompido.mbbackup');
    await copyFile(dryEncrypted, corrupt);
    const bytes = await readFile(corrupt);
    bytes[bytes.length - 22] ^= 0x01;
    await writeFile(corrupt, bytes);
    assert.throws(() => run(['verify', corrupt]), /Command failed|Status|failed|Error/);

    const oldBytes = await readFile(dryEncrypted);
    assert.throws(() => run(['pack', 'mb-dryfit', dry, dryEncrypted]), /Command failed|Status|failed|Error/);
    assert.deepEqual(await readFile(dryEncrypted), oldBytes, 'Um backup existente nunca deve ser apagado.');
    await writeFile(join(temp, 'nao-substituir.tar'), 'NAO APAGAR');
    assert.throws(() => run(['unpack', dryEncrypted, join(temp, 'nao-substituir.tar')]), /Command failed|Status|failed|Error/);
    assert.equal(await readFile(join(temp, 'nao-substituir.tar'), 'utf8'), 'NAO APAGAR');

    const badInput = join(temp, 'nao-permitir-links');
    await mkdir(badInput);
    await symlink(join(dry, 'd1', 'produtos.sql'), join(badInput, 'link.sql'));
    assert.throws(() => run(['pack', 'mb-dryfit', badInput, join(temp, 'link.mbbackup')]), /Command failed|Status|failed|Error/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
