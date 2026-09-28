#!/bin/bash
# Quick API probe to understand actual response structures

BASE_URL="https://source-sync-engine.preview.emergentagent.com"

# Login as admin
echo "=== LOGIN ==="
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fnbgroup.id","password":"Demo@2026"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('access_token') or d.get('access_token',''))")

echo "Token: ${TOKEN:0:20}..."

# Test key endpoints
echo -e "\n=== JOURNAL ENTRIES ===" 
curl -s "$BASE_URL/api/finance/journals?per_page=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== DAILY SALES ==="
curl -s "$BASE_URL/api/outlet/daily-sales?per_page=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== PURCHASE ORDERS ==="
curl -s "$BASE_URL/api/procurement/pos?per_page=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== AP AGING ==="
curl -s "$BASE_URL/api/finance/ap-aging" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30

echo -e "\n=== BALANCE SHEET ==="
curl -s "$BASE_URL/api/finance/balance-sheet" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -40
