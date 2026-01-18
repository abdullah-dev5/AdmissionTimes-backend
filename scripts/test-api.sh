#!/bin/bash

# API Endpoint Testing Script (Bash/Shell)
# Usage: ./scripts/test-api.sh

BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test headers
STUDENT_HEADERS=(
  -H "x-user-id: 7998b0fe-9d05-44e4-94ab-e65e0213bf10"
  -H "x-user-role: student"
)

UNIVERSITY_HEADERS=(
  -H "x-user-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf"
  -H "x-user-role: university"
  -H "x-university-id: 412c9cd6-78db-46c1-84e1-c059a20d11bf"
)

ADMIN_HEADERS=(
  -H "x-user-id: e61690b2-0a64-47de-9274-66e06d1437b7"
  -H "x-user-role: admin"
)

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local path=$3
  local headers=("${@:4}")
  
  echo -n "Testing: $name... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}${path}" "${headers[@]}")
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
      "${headers[@]}" \
      -H "Content-Type: application/json" \
      -d "$5")
  elif [ "$method" = "PUT" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}${path}" \
      "${headers[@]}" \
      -H "Content-Type: application/json" \
      -d "$5")
  elif [ "$method" = "PATCH" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PATCH "${BASE_URL}${path}" \
      "${headers[@]}" \
      -H "Content-Type: application/json" \
      -d "$5")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}${path}" "${headers[@]}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓${NC} $http_code"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $http_code"
    ((FAILED++))
  fi
}

echo "🚀 Starting API Endpoint Tests..."
echo "Base URL: $BASE_URL"
echo ""

# Health Check
echo "=== Health Check ==="
test_endpoint "Health Check" "GET" "/health"

# Admissions Domain
echo ""
echo "=== Admissions Domain ==="
test_endpoint "List Admissions" "GET" "/api/v1/admissions?page=1&limit=10" "${STUDENT_HEADERS[@]}"
test_endpoint "Get Admission Detail" "GET" "/api/v1/admissions/00000000-0000-0000-0000-000000000000" "${STUDENT_HEADERS[@]}"

# Users Domain
echo ""
echo "=== Users Domain ==="
test_endpoint "Get Current User (Student)" "GET" "/api/v1/users/me" "${STUDENT_HEADERS[@]}"
test_endpoint "Get Current User (University)" "GET" "/api/v1/users/me" "${UNIVERSITY_HEADERS[@]}"
test_endpoint "Get Current User (Admin)" "GET" "/api/v1/users/me" "${ADMIN_HEADERS[@]}"

# Notifications Domain
echo ""
echo "=== Notifications Domain ==="
test_endpoint "List Notifications" "GET" "/api/v1/notifications?page=1&limit=10" "${STUDENT_HEADERS[@]}"
test_endpoint "Get Unread Count" "GET" "/api/v1/notifications/unread-count" "${STUDENT_HEADERS[@]}"

# Deadlines Domain
echo ""
echo "=== Deadlines Domain ==="
test_endpoint "List Deadlines" "GET" "/api/v1/deadlines?page=1&limit=10" "${STUDENT_HEADERS[@]}"
test_endpoint "Get Upcoming Deadlines" "GET" "/api/v1/deadlines/upcoming?days=30" "${STUDENT_HEADERS[@]}"

# Analytics Domain
echo ""
echo "=== Analytics Domain ==="
test_endpoint "Track Event" "POST" "/api/v1/analytics/events" "${STUDENT_HEADERS[@]}" '{"event_type":"admission_viewed","entity_type":"admission","entity_id":"00000000-0000-0000-0000-000000000000","user_type":"student"}'
test_endpoint "Get Statistics" "GET" "/api/v1/analytics/stats" "${ADMIN_HEADERS[@]}"

# Changelogs Domain
echo ""
echo "=== Changelogs Domain ==="
test_endpoint "List Changelogs" "GET" "/api/v1/changelogs?page=1&limit=10" "${STUDENT_HEADERS[@]}"

# Watchlists Domain
echo ""
echo "=== Watchlists Domain ==="
test_endpoint "List Watchlists" "GET" "/api/v1/watchlists" "${STUDENT_HEADERS[@]}"

# User Activity Domain
echo ""
echo "=== User Activity Domain ==="
test_endpoint "List Activities" "GET" "/api/v1/activity?page=1&limit=10" "${STUDENT_HEADERS[@]}"

# Dashboard Domain
echo ""
echo "=== Dashboard Domain ==="
test_endpoint "Student Dashboard" "GET" "/api/v1/student/dashboard" "${STUDENT_HEADERS[@]}"
test_endpoint "University Dashboard" "GET" "/api/v1/university/dashboard" "${UNIVERSITY_HEADERS[@]}"
test_endpoint "Admin Dashboard" "GET" "/api/v1/admin/dashboard" "${ADMIN_HEADERS[@]}"

# Summary
echo ""
echo "=== Test Summary ==="
TOTAL=$((PASSED + FAILED))
echo "Total Tests: $TOTAL"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
if [ $TOTAL -gt 0 ]; then
  SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
  echo "Success Rate: ${SUCCESS_RATE}%"
fi
echo ""
