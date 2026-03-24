param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$JwtToken = "",
  [string]$PdfPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Fail($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

Write-Host "AdmissionTimes PDF Parse Smoke Test" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl"

if (-not $JwtToken -or $JwtToken.Trim().Length -eq 0) {
  Fail 'Missing JWT token. Pass -JwtToken "<supabase_access_token>".'
}

if (-not $PdfPath -or $PdfPath.Trim().Length -eq 0) {
  Fail 'Missing PDF path. Pass -PdfPath "C:\path\to\sample.pdf".'
}

if (-not (Test-Path -LiteralPath $PdfPath)) {
  Fail "PDF file not found: $PdfPath"
}

$uri = "$BaseUrl/api/v1/admissions/parse-pdf"

Write-Step "Testing POST /api/v1/admissions/parse-pdf (protected multipart upload)"

$fileBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$fileName = [System.IO.Path]::GetFileName($PdfPath)
$boundary = [System.Guid]::NewGuid().ToString()
$lf = "`r`n"

$header = (
  "--$boundary",
  "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
  "Content-Type: application/pdf",
  "",
  ""
) -join $lf

$footer = ("", "--$boundary--", "") -join $lf

$headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
$footerBytes = [System.Text.Encoding]::UTF8.GetBytes($footer)

$ms = New-Object System.IO.MemoryStream
$ms.Write($headerBytes, 0, $headerBytes.Length)
$ms.Write($fileBytes, 0, $fileBytes.Length)
$ms.Write($footerBytes, 0, $footerBytes.Length)
$bodyBytes = $ms.ToArray()
$ms.Dispose()

$headers = @{
  Authorization = "Bearer $JwtToken"
  "Content-Type" = "multipart/form-data; boundary=$boundary"
}

try {
  $resp = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body $bodyBytes -UseBasicParsing
  $statusCode = [int]$resp.StatusCode
  Write-Host "/api/v1/admissions/parse-pdf status: $statusCode" -ForegroundColor Yellow
  $parsed = $null
  if ($resp.Content) {
    try {
      $parsed = $resp.Content | ConvertFrom-Json
    } catch {
      $parsed = $resp.Content
    }
  }
  try {
    $pretty = $parsed | ConvertTo-Json -Depth 10
    Write-Host $pretty
  } catch {
    Write-Host $parsed
  }

  Write-Host "`nPDF parse smoke test completed." -ForegroundColor Green
} catch {
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    Write-Host "/api/v1/admissions/parse-pdf status: $status" -ForegroundColor Yellow

    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $errBody = $reader.ReadToEnd()
      $reader.Close()
      if ($errBody) {
        Write-Host $errBody
      }
    } catch {
      Write-Host $_.Exception.Message
    }
  } else {
    Write-Host $_.Exception.Message
  }

  exit 1
}
