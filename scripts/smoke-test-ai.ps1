param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$JwtToken = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Print-Result($name, $statusCode, $body) {
  Write-Host "$name status: $statusCode" -ForegroundColor Yellow
  try {
    $pretty = $body | ConvertTo-Json -Depth 8
    Write-Host $pretty
  } catch {
    Write-Host $body
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Uri,
    [string]$Method,
    [hashtable]$Headers = $null,
    [string]$Body = $null,
    [string]$ContentType = "application/json"
  )

  $params = @{
    Uri = $Uri
    Method = $Method
    UseBasicParsing = $true
  }

  if ($Headers) {
    $params.Headers = $Headers
  }

  if ($Body) {
    $params.Body = $Body
    $params.ContentType = $ContentType
  }

  $resp = Invoke-WebRequest @params
  $parsedBody = $null
  if ($resp.Content) {
    try {
      $parsedBody = $resp.Content | ConvertFrom-Json
    } catch {
      $parsedBody = $resp.Content
    }
  }

  return @{
    StatusCode = [int]$resp.StatusCode
    Body = $parsedBody
  }
}

Write-Host "AdmissionTimes AI Smoke Test" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl"

# 1) Public health
Write-Step "Testing GET /health (public)"
$healthResult = Invoke-JsonRequest -Uri "$BaseUrl/health" -Method "GET"
Print-Result "/health" $healthResult.StatusCode $healthResult.Body

if (-not $JwtToken -or $JwtToken.Trim().Length -eq 0) {
  Write-Host "`nNo JWT token provided. Protected AI endpoint tests skipped." -ForegroundColor Magenta
  Write-Host 'Pass -JwtToken "<supabase_access_token>" to test /api/v1/ai/* endpoints.' -ForegroundColor Magenta
  exit 0
}

$headers = @{ Authorization = "Bearer $JwtToken" }

# 2) AI health (protected)
Write-Step "Testing GET /api/v1/ai/health (protected)"
$aiHealthResult = Invoke-JsonRequest -Uri "$BaseUrl/api/v1/ai/health" -Method "GET" -Headers $headers
Print-Result "/api/v1/ai/health" $aiHealthResult.StatusCode $aiHealthResult.Body

# 3) AI chat (protected)
Write-Step "Testing POST /api/v1/ai/chat (protected)"
$chatBody = @{
  message = "CS admissions in Karachi"
  conversation_context = "Student Dashboard"
} | ConvertTo-Json

$chatResult = Invoke-JsonRequest -Uri "$BaseUrl/api/v1/ai/chat" -Method "POST" -Headers $headers -Body $chatBody
Print-Result "/api/v1/ai/chat" $chatResult.StatusCode $chatResult.Body

Write-Host "`nSmoke test completed." -ForegroundColor Green
