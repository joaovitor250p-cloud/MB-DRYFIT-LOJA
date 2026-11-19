// Verifica APENAS o download do instalador. Não toca no programa de impressão.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DOWNLOAD='https://github.com/joaovitor250p-cloud/MB-DRYFIT-LOJA/releases/download/mb-impressao-elgin-2026-11-19/MB-Impressao-Elgin-Windows.zip';
const EXPECTED_SHA='448e4dc5e5d8e5f7a5b2adcc88e18fda791c1f3abae84f8c221420b487f6483b';

for (const store of ['mb-dryfit','mb-for-her']){
  const base='stores/'+store+'/worker/';
  const panel=readFileSync(base+'staff-sales.js','utf8');
  const api=readFileSync(base+'api.js','utf8');
  assert.equal(panel.split(DOWNLOAD).length-1,1,store+': painel sem URL da GitHub Release');
  assert.match(panel,/<a class="primary" href="https:\/\/github\.com\/[^"]+\/MB-Impressao-Elgin-Windows\.zip" download="MB-Impressao-Elgin-Windows\.zip">/,store+': botão alterado inesperadamente');
  assert.equal(api.split(DOWNLOAD).length-1,1,store+': rota antiga sem fallback para a Release');
  const begin=api.indexOf("if(u.pathname==='/downloads/mb-impressao-elgin-windows.zip'&&req.method==='GET'){");
  assert.ok(begin!==-1,store+': rota antiga removida');
  const route=api.slice(begin,api.indexOf("\nif(u.pathname==='/vendor/three.min.js')",begin));
  assert.match(route,/status:302/,store+': redirecionamento temporário não configurado');
  assert.ok(!route.includes("env.BUCKET"),store+': ZIP ainda depende do R2 no fallback');
  console.log(store+': painel e redirecionamento antigo apontam exclusivamente para a Release');
}

const reply=await fetch('https://api.github.com/repos/joaovitor250p-cloud/MB-DRYFIT-LOJA/releases/tags/mb-impressao-elgin-2026-11-19',{
  headers:{'Accept':'application/vnd.github+json','User-Agent':'MB-Installer-Release-Link-Test'}
});
assert.ok(reply.ok,'GitHub Release não disponível ('+reply.status+')');
const release=await reply.json();
assert.ok(!release.draft&&!release.prerelease,'Release ainda não pública e estável');
const asset=release.assets.find(a=>a.name==='MB-Impressao-Elgin-Windows.zip');
assert.ok(asset,'Instalador ausente da Release');
assert.equal(asset.digest,'sha256:'+EXPECTED_SHA,'SHA da Release mudou');
assert.ok(asset.size>5_000_000,'Tamanho do arquivo inesperado');
assert.equal(asset.browser_download_url,DOWNLOAD);
console.log('Github Release disponível. SHA256 e URL corretos. Bytes='+asset.size);
