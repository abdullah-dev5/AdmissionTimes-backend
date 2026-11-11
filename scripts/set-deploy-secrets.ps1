<#
  Sets the GitHub Actions secrets the deployment needs, from .env.vercel.
  Run from the admission-times-backend folder after the API is deployed:

    powershell -ExecutionPolicy Bypass -File scripts\set-deploy-secrets.ps1
    powershell -ExecutionPolicy Bypass -File scripts\set-deploy-secrets.ps1 -IncludeScrapers

  -ApiUrl          the deployed API (default https://admissiontimes-api.vercel.app)
  -IncludeScrapers also connect the daily scraper workflow. Its next run
                   replaces the demo deadlines with the universities' real dates,
                   and it needs admin rights on Aryan-iz/AdmissionTimes-Scrapers.

  Values are piped to `gh secret set`; nothing is printed.
#>
param(
  [string]$ApiUrl = "https://admissiontimes-api.vercel.app",
  [switch]$IncludeScrapers
)
$ErrorActionPreference = "Stop"

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.vercel"
if (-not (Test-Path $envFile)) { throw ".env.vercel not found next to package.json" }

function Get-EnvValue([string]$name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { throw "$name missing in .env.vercel" }
  return $line.Substring($name.Length + 1).Trim()
}

function Set-Secret([string]$repo, [string]$name, [string]$value) {
  $value | gh secret set $name -R $repo
  if ($LASTEXITCODE -ne 0) { throw "Could not set $name on $repo" }
  Write-Host "set $name on $repo"
}

$ApiUrl = $ApiUrl.TrimEnd("/")
$backend = "abdullah-dev5/AdmissionTimes-backend"
Set-Secret $backend "API_BASE_URL" $ApiUrl
Set-Secret $backend "CRON_SECRET" (Get-EnvValue "CRON_SECRET")

if ($IncludeScrapers) {
  $scrapers = "Aryan-iz/AdmissionTimes-Scrapers"
  Set-Secret $scrapers "BACKEND_BASE_URL" $ApiUrl
  Set-Secret $scrapers "SCRAPER_INTERNAL_SERVICE_TOKEN" (Get-EnvValue "SCRAPER_INTERNAL_SERVICE_TOKEN")
}

Write-Host "Done. Check: GitHub -> AdmissionTimes-backend -> Actions -> Scheduled jobs -> Run workflow."
