param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$JwtToken = "",
  [string]$PdfPath = "",
  [switch]$SkipPdf
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "[PASS] $message" -ForegroundColor Green
}

function Write-WarnMsg($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Fail($message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Test-Endpoint($url) {
  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 8
    return @{ Success = $true; StatusCode = [int]$response.StatusCode }
  } catch {
    return @{ Success = $false; StatusCode = -1; Error = $_.Exception.Message }
  }
}

Write-Host "AdmissionTimes Run-Check-Test" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl"

$healthUrl = "$BaseUrl/health"
Write-Step "Checking backend health endpoint"
$health = Test-Endpoint -url $healthUrl

if ($health.Success) {
  Write-Ok "/health responded with status $($health.StatusCode)"
} else {
  Write-Fail "Backend is not reachable at $healthUrl"
  Write-Host "Error: $($health.Error)"
  Write-Host "Start backend first: pnpm --dir E:\fyp\admission-times-backend dev"
  exit 1
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$aiScript = Join-Path $scriptRoot "smoke-test-ai.ps1"
$pdfScript = Join-Path $scriptRoot "smoke-test-parse-pdf.ps1"

if (-not (Test-Path -LiteralPath $aiScript)) {
  Write-Fail "Missing script: $aiScript"
  exit 1
}

Write-Step "Running AI smoke test script"
$aiArgs = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $aiScript,
  "-BaseUrl", $BaseUrl
)
if ($JwtToken -and $JwtToken.Trim().Length -gt 0) {
  $aiArgs += @("-JwtToken", $JwtToken)
} else {
  Write-WarnMsg "No JwtToken provided. Protected AI endpoints will be skipped by smoke-test-ai.ps1."
}

& powershell @aiArgs
if ($LASTEXITCODE -ne 0) {
  Write-Fail "AI smoke test failed."
  exit $LASTEXITCODE
}
Write-Ok "AI smoke test completed."

if ($SkipPdf) {
  Write-WarnMsg "Skipping PDF parse test because -SkipPdf was provided."
  Write-Ok "Run-check-test completed."
  exit 0
}

if (-not $JwtToken -or $JwtToken.Trim().Length -eq 0) {
  Write-WarnMsg "PDF parse test skipped because JwtToken was not provided."
  Write-Ok "Run-check-test completed with partial coverage."
  exit 0
}

if (-not $PdfPath -or $PdfPath.Trim().Length -eq 0) {
  Write-WarnMsg "PDF parse test skipped because PdfPath was not provided."
  Write-Host "Provide -PdfPath \"C:\path\to\sample.pdf\" to include parse-pdf verification."
  Write-Ok "Run-check-test completed with partial coverage."
  exit 0
}

if (-not (Test-Path -LiteralPath $pdfScript)) {
  Write-Fail "Missing script: $pdfScript"
  exit 1
}

Write-Step "Running PDF parse smoke test script"
& powershell -ExecutionPolicy Bypass -File $pdfScript -BaseUrl $BaseUrl -JwtToken $JwtToken -PdfPath $PdfPath
if ($LASTEXITCODE -ne 0) {
  Write-Fail "PDF parse smoke test failed."
  exit $LASTEXITCODE
}

Write-Ok "PDF parse smoke test completed."
Write-Ok "All requested checks completed."
