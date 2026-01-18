# API Endpoint Testing Script (PowerShell)
# Usage: .\scripts\test-api.ps1

$BASE_URL = "http://localhost:3000"
$API_BASE = "$BASE_URL/api/v1"

# Test headers
$STUDENT_HEADERS = @{
    "x-user-id" = "7998b0fe-9d05-44e4-94ab-e65e0213bf10"
    "x-user-role" = "student"
}

$UNIVERSITY_HEADERS = @{
    "x-user-id" = "412c9cd6-78db-46c1-84e1-c059a20d11bf"
    "x-user-role" = "university"
    "x-university-id" = "412c9cd6-78db-46c1-84e1-c059a20d11bf"
}

$ADMIN_HEADERS = @{
    "x-user-id" = "e61690b2-0a64-47de-9274-66e06d1437b7"
    "x-user-role" = "admin"
}

# Test counter
$script:PASSED = 0
$script:FAILED = 0

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    Write-Host -NoNewline "Testing: $Name... "
    
    $uri = "$BASE_URL$Path"
    $requestHeaders = @{
        "Content-Type" = "application/json"
    }
    
    foreach ($key in $Headers.Keys) {
        $requestHeaders[$key] = $Headers[$key]
    }
    
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $requestHeaders
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-RestMethod @params
        $statusCode = 200
        
        # Try to get status code from response
        try {
            $webResponse = Invoke-WebRequest -Uri $uri -Method $Method -Headers $requestHeaders -ErrorAction Stop
            $statusCode = $webResponse.StatusCode
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        
        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            Write-Host -ForegroundColor Green "✓ $statusCode"
            $script:PASSED++
        } else {
            Write-Host -ForegroundColor Red "✗ $statusCode"
            $script:FAILED++
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if (-not $statusCode) { $statusCode = 0 }
        Write-Host -ForegroundColor Red "✗ $statusCode - $($_.Exception.Message)"
        $script:FAILED++
    }
}

Write-Host "🚀 Starting API Endpoint Tests..."
Write-Host "Base URL: $BASE_URL"
Write-Host ""

# Health Check
Write-Host "=== Health Check ==="
Test-Endpoint -Name "Health Check" -Method "GET" -Path "/health"

# Admissions Domain
Write-Host ""
Write-Host "=== Admissions Domain ==="
Test-Endpoint -Name "List Admissions" -Method "GET" -Path "/api/v1/admissions?page=1&limit=10" -Headers $STUDENT_HEADERS
Test-Endpoint -Name "Get Admission Detail" -Method "GET" -Path "/api/v1/admissions/00000000-0000-0000-0000-000000000000" -Headers $STUDENT_HEADERS

# Users Domain
Write-Host ""
Write-Host "=== Users Domain ==="
Test-Endpoint -Name "Get Current User (Student)" -Method "GET" -Path "/api/v1/users/me" -Headers $STUDENT_HEADERS
Test-Endpoint -Name "Get Current User (University)" -Method "GET" -Path "/api/v1/users/me" -Headers $UNIVERSITY_HEADERS
Test-Endpoint -Name "Get Current User (Admin)" -Method "GET" -Path "/api/v1/users/me" -Headers $ADMIN_HEADERS

# Notifications Domain
Write-Host ""
Write-Host "=== Notifications Domain ==="
Test-Endpoint -Name "List Notifications" -Method "GET" -Path "/api/v1/notifications?page=1&limit=10" -Headers $STUDENT_HEADERS
Test-Endpoint -Name "Get Unread Count" -Method "GET" -Path "/api/v1/notifications/unread-count" -Headers $STUDENT_HEADERS

# Deadlines Domain
Write-Host ""
Write-Host "=== Deadlines Domain ==="
Test-Endpoint -Name "List Deadlines" -Method "GET" -Path "/api/v1/deadlines?page=1&limit=10" -Headers $STUDENT_HEADERS
Test-Endpoint -Name "Get Upcoming Deadlines" -Method "GET" -Path "/api/v1/deadlines/upcoming?days=30" -Headers $STUDENT_HEADERS

# Analytics Domain
Write-Host ""
Write-Host "=== Analytics Domain ==="
$eventBody = '{"event_type":"admission_viewed","entity_type":"admission","entity_id":"00000000-0000-0000-0000-000000000000","user_type":"student"}'
Test-Endpoint -Name "Track Event" -Method "POST" -Path "/api/v1/analytics/events" -Headers $STUDENT_HEADERS -Body $eventBody
Test-Endpoint -Name "Get Statistics" -Method "GET" -Path "/api/v1/analytics/stats" -Headers $ADMIN_HEADERS

# Changelogs Domain
Write-Host ""
Write-Host "=== Changelogs Domain ==="
Test-Endpoint -Name "List Changelogs" -Method "GET" -Path "/api/v1/changelogs?page=1&limit=10" -Headers $STUDENT_HEADERS

# Watchlists Domain
Write-Host ""
Write-Host "=== Watchlists Domain ==="
Test-Endpoint -Name "List Watchlists" -Method "GET" -Path "/api/v1/watchlists" -Headers $STUDENT_HEADERS

# User Activity Domain
Write-Host ""
Write-Host "=== User Activity Domain ==="
Test-Endpoint -Name "List Activities" -Method "GET" -Path "/api/v1/activity?page=1&limit=10" -Headers $STUDENT_HEADERS

# Dashboard Domain
Write-Host ""
Write-Host "=== Dashboard Domain ==="
Test-Endpoint -Name "Student Dashboard" -Method "GET" -Path "/api/v1/student/dashboard" -Headers $STUDENT_HEADERS
Test-Endpoint -Name "University Dashboard" -Method "GET" -Path "/api/v1/university/dashboard" -Headers $UNIVERSITY_HEADERS
Test-Endpoint -Name "Admin Dashboard" -Method "GET" -Path "/api/v1/admin/dashboard" -Headers $ADMIN_HEADERS

# Summary
Write-Host ""
Write-Host "=== Test Summary ==="
$TOTAL = $script:PASSED + $script:FAILED
Write-Host "Total Tests: $TOTAL"
Write-Host -ForegroundColor Green "✓ Passed: $($script:PASSED)"
Write-Host -ForegroundColor Red "✗ Failed: $($script:FAILED)"
if ($TOTAL -gt 0) {
    $SUCCESS_RATE = [math]::Round(($script:PASSED / $TOTAL) * 100, 1)
    Write-Host "Success Rate: ${SUCCESS_RATE}%"
}
Write-Host ""
