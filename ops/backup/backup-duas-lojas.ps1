# Requer Windows PowerShell 5.1+ ou PowerShell 7, Node 24, AWS CLI e npm ci.
# Sem -Execute: apenas mostra o plano (nenhuma conexão ou gravação).
# Com -Execute: exporta somente leitura e cria dois arquivos cifrados diferentes.
param(
  [switch]$Execute,
  [string]$Destination = (Join-Path $HOME 'MB-Backups')
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runner = Join-Path $repoRoot 'ops\backup\export-cloudflare.mjs'

function Read-PrivateSecret([string]$label) {
  $secure = Read-Host $label -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

Push-Location $repoRoot
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 24 ou superior.' }
  if (-not $Execute) {
    Write-Host 'PLANO DE BACKUP - nenhum banco sera acessado' -ForegroundColor Cyan
    & node $runner --store mb-dryfit --destination $Destination --plan
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar o plano Dryfit.' }
    & node $runner --store mb-for-her --destination $Destination --plan
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar o plano For Her.' }
    Write-Host 'Plano concluido. Para executar com autenticacao local, use -Execute.' -ForegroundColor Green
    exit
  }
  if (-not (Test-Path (Join-Path $repoRoot 'node_modules\wrangler\bin\wrangler.js'))) {
    throw 'Execute npm ci na pasta do projeto antes de exportar.'
  }
  if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw 'Instale AWS CLI com suporte ao R2/S3.' }
  if (-not (Get-Command tar -ErrorAction SilentlyContinue)) { throw 'O comando tar nao esta disponivel.' }

  Write-Host 'A EXPORTACAO E SOMENTE LEITURA. Ela nao executa deploy nem restaura banco.' -ForegroundColor Yellow
  Write-Host 'Os dados temporarios sao gravados em disco: use um computador com disco criptografado.'
  Write-Host ('Destino privado: ' + $Destination)
  $answer = Read-Host 'Digite EXPORTAR para gerar um backup cifrado de CADA loja'
  if ($answer -cne 'EXPORTAR') { Write-Host 'Operacao cancelada.'; exit }

  # As credenciais existem somente como variaveis do processo local enquanto o comando roda.
  # Nenhum segredo e salvo em arquivo ou passado como argumento de linha de comando.
  $env:CLOUDFLARE_API_TOKEN = Read-PrivateSecret 'Token Cloudflare somente leitura do D1'
  $env:AWS_ACCESS_KEY_ID = Read-PrivateSecret 'R2 Access Key ID (leitura)'
  $env:AWS_SECRET_ACCESS_KEY = Read-PrivateSecret 'R2 Secret Access Key (leitura)'
  $env:MB_BACKUP_PASSPHRASE = Read-PrivateSecret 'Senha longa (16+ caracteres) para os backups'

  foreach ($store in @('mb-dryfit','mb-for-her')) {
    Write-Host ('Exportando ' + $store + '...') -ForegroundColor Cyan
    & node $runner --store $store --destination $Destination --execute
    if ($LASTEXITCODE -ne 0) { throw ('Exportacao falhou para ' + $store + '. A outra loja nao foi modificada.') }
  }
  Write-Host 'Pacotes individuais gerados e autenticados. Teste a restauracao isolada antes de considerar backups completos.' -ForegroundColor Green
} finally {
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
  Remove-Item Env:AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:MB_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  Pop-Location
}
