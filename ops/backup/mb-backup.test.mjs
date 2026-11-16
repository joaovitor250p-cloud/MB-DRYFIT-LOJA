import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createManifest, verifyManifest } from './mb-manifest.mjs';

const cli = resolve('ops/backup/mb-backup.mjs');
const PASS = 'uma-frase-de-recuperacao-forte-para-testes';
function run(args, password = PASS, extraEnv = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    env: { ...process.env, MB_BACKUP_PASSPHRASE: password, ...extraEnv },
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
    // Falhar sem inventário: nunca anunciar um backup de exportação não verificada.
    assert.throws(() => run(['pack', 'mb-dryfit', dry, dryEncrypted]), /Command failed|Status|failed|Error/);
    const mDry = await createManifest('mb-dryfit', dry);
    const mHer = await createManifest('mb-for-her', her);
    assert.equal(mDry.coverage.d1_files, 1);
    assert.equal(mDry.coverage.r2_files, 1);
    assert.equal(mHer.coverage.r2_files, 0);
    assert.equal((await verifyManifest('mb-dryfit', dry)).store, 'mb-dryfit');
    await assert.rejects(verifyManifest('mb-for-her', dry), /Inventário divergente/);
    if (process.platform !== 'win32') {
      // Simular tar encerrando com erro APÓS o arquivo de saída ser aberto.
      // Um backup parcial não deve permanecer no disco.
      const bin = join(temp, 'fake-bin');
      await mkdir(bin);
      await writeFile(join(bin, 'tar'), '#!/usr/bin/env node\nprocess.exit(9);\n');
      await chmod(join(bin, 'tar'), 0o755);
      const partial = join(temp, 'pacote-parcial.mbbackup');
      assert.throws(() => run(['pack', 'mb-dryfit', dry, partial], PASS, {
        PATH: bin + delimiter + process.env.PATH
      }), /Command failed|Status|failed|Error/);
      await assert.rejects(readFile(partial), { code: 'ENOENT' }, 'Arquivo parcial deve ser excluído após erro.');
    }
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
    assert.equal((await verifyManifest('mb-dryfit', extracted)).files.length, mDry.files.length);
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
    await writeFile(join(dry, 'd1', 'produtos.sql'), "INSERT INTO codigos VALUES ('0000000088');\\n");
    await assert.rejects(verifyManifest('mb-dryfit', dry), /Inventário divergente/);
    assert.throws(() => run(['pack', 'mb-dryfit', dry, join(temp, 'tampered-source.mbbackup')]), /Command failed|Status|failed|Error/);
    assert.deepEqual(await readFile(dryEncrypted), oldBytes);
    await writeFile(join(temp, 'nao-substituir.tar'), 'NAO APAGAR');
    assert.throws(() => run(['unpack', dryEncrypted, join(temp, 'nao-substituir.tar')]), /Command failed|Status|failed|Error/);
    assert.equal(await readFile(join(temp, 'nao-substituir.tar'), 'utf8'), 'NAO APAGAR');

    const badInput = join(temp, 'nao-permitir-links');
    await mkdir(badInput);
    await symlink(join(dry, 'd1', 'produtos.sql'), join(badInput, 'link.sql'));
    await assert.rejects(createManifest('mb-dryfit', badInput), /Link simbólico/);
    assert.throws(() => run(['pack', 'mb-dryfit', badInput, join(temp, 'link.mbbackup')]), /Command failed|Status|failed|Error/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
