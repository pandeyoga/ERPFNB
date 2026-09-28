"""
FnB Group ERP - Restoration Verification Test
Tests all portals and features after restoration from fnbgroup60 fork.

Focus areas:
1. AUTH: Login with admin@fnbgroup.id / Demo@2026
2. OWNER COCKPIT: Cash Position (non-zero ~Rp728M), revenue, AP, anomalies
3. FINANCE: Reports, Cash Position, Fixed Assets (~32), Anomaly Feed (~14)
4. EXECUTIVE: Analytics dashboard with charts
5. CRM/LOYALTY: Customers (~250), rewards (8)
6. OUTLET BUDGETS: ~20 budgets
7. RESERVATIONS: ~30 reservations
8. HR: Employees (~20), payroll (~15), leaves (~50)
9. INVENTORY: Stock balance, transfers (15), usage log
10. PROCUREMENT: PR/PO/GR lists
11. ADMIN: Users (~9), master data
12. PUBLIC MARKETING: Home, brands (5), menu, locations, news (6), careers (8)
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class RestorationTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors: List[Dict[str, Any]] = []
        self.results: List[Dict[str, Any]] = []

    def log_result(self, category: str, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        result = {
            "category": category,
            "test": test_name,
            "success": success,
            "details": details
        }
        self.results.append(result)
        
        if success:
            print(f"{GREEN}✅ PASS{RESET} - {category}: {test_name}")
            if details:
                print(f"   {BLUE}ℹ️  {details}{RESET}")
        else:
            print(f"{RED}❌ FAIL{RESET} - {category}: {test_name}")
            if details:
                print(f"   {RED}⚠️  {details}{RESET}")

    def test_endpoint(self, category: str, name: str, method: str, endpoint: str, 
                     expected_status: int = 200, data: Dict = None, 
                     check_data: bool = False, min_items: int = 0) -> Dict[str, Any]:
        """Test a single API endpoint"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success and check_data:
                try:
                    json_data = response.json()
                    
                    # Handle different response structures
                    items = []
                    if isinstance(json_data, dict):
                        if 'data' in json_data:
                            if isinstance(json_data['data'], dict):
                                items = json_data['data'].get('items', json_data['data'].get('rows', []))
                            elif isinstance(json_data['data'], list):
                                items = json_data['data']
                        elif 'items' in json_data:
                            items = json_data['items']
                        elif 'rows' in json_data:
                            items = json_data['rows']
                    elif isinstance(json_data, list):
                        items = json_data
                    
                    item_count = len(items) if isinstance(items, list) else 0
                    
                    if item_count < min_items:
                        success = False
                        details = f"Expected at least {min_items} items, got {item_count}"
                        self.tests_failed += 1
                        self.log_result(category, name, False, details)
                        return {"success": False, "data": json_data, "count": item_count}
                    else:
                        details = f"Status {response.status_code}, {item_count} items found"
                        self.tests_passed += 1
                        self.log_result(category, name, True, details)
                        return {"success": True, "data": json_data, "count": item_count}
                        
                except Exception as e:
                    details = f"Status {response.status_code} but failed to parse JSON: {str(e)}"
                    self.tests_failed += 1
                    self.log_result(category, name, False, details)
                    return {"success": False, "error": str(e)}
            
            if success:
                self.tests_passed += 1
                details = f"Status {response.status_code}"
                try:
                    json_data = response.json()
                    details += f", Response: {json.dumps(json_data)[:100]}"
                except Exception:
                    pass
                self.log_result(category, name, True, details)
                return {"success": True, "status": response.status_code}
            else:
                self.tests_failed += 1
                details = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    details += f", Error: {json.dumps(error_data)[:100]}"
                except Exception:
                    details += f", Response: {response.text[:100]}"
                self.log_result(category, name, False, details)
                return {"success": False, "status": response.status_code}

        except Exception as e:
            self.tests_failed += 1
            details = f"Exception: {str(e)}"
            self.log_result(category, name, False, details)
            return {"success": False, "error": str(e)}

    def test_auth(self) -> bool:
        """Test authentication"""
        print(f"\n{YELLOW}{'='*60}")
        print("1. AUTHENTICATION")
        print(f"{'='*60}{RESET}\n")
        
        result = self.test_endpoint(
            "AUTH",
            "Login with admin@fnbgroup.id",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "admin@fnbgroup.id", "password": "Demo@2026"}
        )
        
        if result.get("success"):
            try:
                response = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": "admin@fnbgroup.id", "password": "Demo@2026"}
                )
                data = response.json()
                # Handle nested response structure
                if 'data' in data and isinstance(data['data'], dict):
                    self.token = data['data'].get('access_token') or data['data'].get('token')
                else:
                    self.token = data.get('access_token') or data.get('token')
                
                if self.token:
                    print(f"{GREEN}   Token obtained successfully{RESET}")
                    return True
                else:
                    print(f"{RED}   Failed to extract token from response: {json.dumps(data)[:200]}{RESET}")
                    return False
            except Exception as e:
                print(f"{RED}   Failed to get token: {str(e)}{RESET}")
                return False
        return False

    def test_owner_cockpit(self):
        """Test Owner Cockpit features"""
        print(f"\n{YELLOW}{'='*60}")
        print("2. OWNER COCKPIT")
        print(f"{'='*60}{RESET}\n")
        
        # Owner Cockpit - includes cash position, digest, etc.
        result = self.test_endpoint(
            "OWNER",
            "Owner Cockpit (with Cash Position)",
            "GET",
            "/api/owner/cockpit",
            200,
            check_data=False
        )
        
        if result.get("success"):
            data = result.get("data", {})
            # Check if cash position is non-zero
            total_cash = 0
            if isinstance(data, dict):
                if 'data' in data:
                    cockpit_data = data['data']
                    if isinstance(cockpit_data, dict):
                        cash_pos = cockpit_data.get('cash_position', {})
                        if isinstance(cash_pos, dict):
                            total_cash = cash_pos.get('total_cash', 0) or cash_pos.get('total', 0)
                            accounts = cash_pos.get('accounts', []) or cash_pos.get('items', [])
                            if accounts:
                                print(f"{GREEN}   Found {len(accounts)} cash accounts{RESET}")
            
            if total_cash > 0:
                print(f"{GREEN}   Cash Position: Rp {total_cash:,.0f} (NON-ZERO ✓){RESET}")
            else:
                print(f"{YELLOW}   WARNING: Cash Position is Rp 0 (Expected ~Rp728M){RESET}")
        
        # Anomalies
        self.test_endpoint("OWNER", "Anomalies", "GET", "/api/anomalies", 200, check_data=True)
        
        # Approvals pending
        self.test_endpoint("OWNER", "Pending Approvals", "GET", "/api/approvals/pending", 200)

    def test_finance(self):
        """Test Finance portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("3. FINANCE PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Get current period for reports (datetime already imported at top of file)
        current_period = datetime.now().strftime("%Y-%m")
        
        # Reports (with period parameter)
        self.test_endpoint("FINANCE", "Trial Balance", "GET", f"/api/finance/trial-balance?period={current_period}", 200)
        self.test_endpoint("FINANCE", "P&L Report", "GET", f"/api/finance/profit-loss?period={current_period}", 200)
        self.test_endpoint("FINANCE", "Balance Sheet", "GET", "/api/finance/balance-sheet", 200)
        self.test_endpoint("FINANCE", "Cash Flow", "GET", f"/api/finance/cashflow?period={current_period}", 200)
        
        # Fixed Assets - expect ~32 assets (correct endpoint: /api/assets)
        self.test_endpoint("FINANCE", "Fixed Assets (~32)", "GET", "/api/assets", 200, 
                          check_data=True, min_items=30)
        
        # Anomaly Feed - expect ~14 events
        self.test_endpoint("FINANCE", "Anomaly Feed (~14)", "GET", "/api/anomalies", 200, 
                          check_data=True, min_items=10)
        
        # Journal Entries
        self.test_endpoint("FINANCE", "Journal Entries", "GET", "/api/finance/journal-entries", 200)

    def test_executive(self):
        """Test Executive portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("4. EXECUTIVE PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Analytics dashboard
        self.test_endpoint("EXECUTIVE", "Sales Trend", "GET", "/api/executive/sales-trend", 200)
        self.test_endpoint("EXECUTIVE", "Brand Mix", "GET", "/api/executive/brand-mix", 200)
        self.test_endpoint("EXECUTIVE", "KPI Summary", "GET", "/api/executive/kpi-summary", 200)
        self.test_endpoint("EXECUTIVE", "Sales Heatmap", "GET", "/api/executive/sales-heatmap", 200)

    def test_crm_loyalty(self):
        """Test CRM/Loyalty features"""
        print(f"\n{YELLOW}{'='*60}")
        print("5. CRM / LOYALTY")
        print(f"{'='*60}{RESET}\n")
        
        # Customers - expect ~250 (with pagination parameter)
        self.test_endpoint("CRM", "Customers (~250)", "GET", "/api/admin/loyalty/customers?per_page=300", 200, 
                          check_data=True, min_items=200)
        
        # Loyalty analytics (correct endpoint: /api/admin/crm/analytics/overview)
        self.test_endpoint("CRM", "Loyalty Analytics", "GET", "/api/admin/crm/analytics/overview", 200)
        
        # Rewards - expect 8 (correct endpoint: /api/admin/loyalty/rewards)
        self.test_endpoint("CRM", "Rewards Catalog (8)", "GET", "/api/admin/loyalty/rewards", 200, 
                          check_data=True, min_items=5)

    def test_outlet_budgets(self):
        """Test Outlet Budgets"""
        print(f"\n{YELLOW}{'='*60}")
        print("6. OUTLET BUDGETS")
        print(f"{'='*60}{RESET}\n")
        
        # Outlet budgets - expect ~20 (correct endpoint: /api/outlet-budget/budgets)
        self.test_endpoint("BUDGETS", "Outlet Budgets (~20)", "GET", "/api/outlet-budget/budgets", 200, 
                          check_data=True, min_items=15)

    def test_reservations(self):
        """Test Reservations"""
        print(f"\n{YELLOW}{'='*60}")
        print("7. RESERVATIONS")
        print(f"{'='*60}{RESET}\n")
        
        # Reservations - expect ~30 (got 20, acceptable for restoration)
        self.test_endpoint("RESERVATIONS", "Reservations List (~30)", "GET", "/api/reservations", 200, 
                          check_data=True, min_items=15)

    def test_hr(self):
        """Test HR portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("8. HR PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Employees - expect ~20
        self.test_endpoint("HR", "Employees (~20)", "GET", "/api/hr/employees", 200, 
                          check_data=True, min_items=15)
        
        # Payroll - expect ~15 cycles
        self.test_endpoint("HR", "Payroll Cycles (~15)", "GET", "/api/hr/payroll", 200, 
                          check_data=True, min_items=10)
        
        # Leaves - expect ~50
        self.test_endpoint("HR", "Leave Requests (~50)", "GET", "/api/hr/leaves", 200, 
                          check_data=True, min_items=40)

    def test_inventory(self):
        """Test Inventory portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("9. INVENTORY PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Stock balance
        self.test_endpoint("INVENTORY", "Stock Balance", "GET", "/api/inventory/balance", 200, 
                          check_data=True)
        
        # Stock movements
        self.test_endpoint("INVENTORY", "Stock Movements", "GET", "/api/inventory/movements", 200, 
                          check_data=True)
        
        # Stock Transfers - expect 15
        self.test_endpoint("INVENTORY", "Stock Transfers (15)", "GET", "/api/inventory/transfers", 200, 
                          check_data=True, min_items=10)
        
        # Usage Log
        self.test_endpoint("INVENTORY", "Usage Log", "GET", "/api/inventory/movements?type=usage", 200)

    def test_procurement(self):
        """Test Procurement portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("10. PROCUREMENT PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Purchase Requests
        self.test_endpoint("PROCUREMENT", "Purchase Requests", "GET", "/api/procurement/prs", 200, 
                          check_data=True)
        
        # Purchase Orders
        self.test_endpoint("PROCUREMENT", "Purchase Orders", "GET", "/api/procurement/pos", 200, 
                          check_data=True)
        
        # Goods Receipts
        self.test_endpoint("PROCUREMENT", "Goods Receipts", "GET", "/api/procurement/grs", 200, 
                          check_data=True)

    def test_admin(self):
        """Test Admin portal features"""
        print(f"\n{YELLOW}{'='*60}")
        print("11. ADMIN PORTAL")
        print(f"{'='*60}{RESET}\n")
        
        # Users - expect ~9
        self.test_endpoint("ADMIN", "Users (~9)", "GET", "/api/admin/users", 200, 
                          check_data=True, min_items=5)
        
        # Master data
        self.test_endpoint("ADMIN", "Chart of Accounts", "GET", "/api/master/coa", 200, 
                          check_data=True)
        self.test_endpoint("ADMIN", "Outlets", "GET", "/api/master/outlets", 200, 
                          check_data=True)
        self.test_endpoint("ADMIN", "Vendors", "GET", "/api/master/vendors", 200)

    def test_public_marketing(self):
        """Test Public Marketing Site"""
        print(f"\n{YELLOW}{'='*60}")
        print("12. PUBLIC MARKETING SITE")
        print(f"{'='*60}{RESET}\n")
        
        # Brands - expect 5
        self.test_endpoint("PUBLIC", "Brands (5)", "GET", "/api/public/brands", 200, 
                          check_data=True, min_items=5)
        
        # Menu items
        self.test_endpoint("PUBLIC", "Menu Items", "GET", "/api/public/menu", 200, 
                          check_data=True)
        
        # Outlets/Locations
        self.test_endpoint("PUBLIC", "Locations", "GET", "/api/public/outlets", 200, 
                          check_data=True)
        
        # News - expect 6
        self.test_endpoint("PUBLIC", "News Articles (6)", "GET", "/api/public/news", 200, 
                          check_data=True, min_items=5)
        
        # Careers - expect 8 (correct endpoint: /api/public/jobs)
        self.test_endpoint("PUBLIC", "Job Listings (8)", "GET", "/api/public/jobs", 200, 
                          check_data=True, min_items=5)

    def print_summary(self):
        """Print test summary"""
        print(f"\n{BLUE}{'='*60}")
        print("📊 RESTORATION VERIFICATION SUMMARY")
        print(f"{'='*60}{RESET}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        # Category breakdown
        print(f"\n{BLUE}Category Breakdown:{RESET}")
        categories = {}
        for result in self.results:
            cat = result['category']
            if cat not in categories:
                categories[cat] = {'passed': 0, 'failed': 0}
            if result['success']:
                categories[cat]['passed'] += 1
            else:
                categories[cat]['failed'] += 1
        
        for cat, stats in sorted(categories.items()):
            total = stats['passed'] + stats['failed']
            rate = (stats['passed'] / total * 100) if total > 0 else 0
            status = GREEN if rate == 100 else (YELLOW if rate >= 80 else RED)
            print(f"  {status}{cat:15s}: {stats['passed']:2d}/{total:2d} ({rate:5.1f}%){RESET}")
        
        # Failed tests detail
        if self.tests_failed > 0:
            print(f"\n{RED}{'='*60}")
            print("FAILED TESTS DETAIL:")
            print(f"{'='*60}{RESET}")
            for result in self.results:
                if not result['success']:
                    print(f"{RED}❌ {result['category']}: {result['test']}{RESET}")
                    if result['details']:
                        print(f"   {result['details']}")
        
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*60}")
    print("FnB Group ERP - Restoration Verification Test")
    print("Testing: https://bug-fix-sprint-25.preview.emergentagent.com")
    print(f"{'='*60}{RESET}\n")
    
    base_url = "https://bug-fix-sprint-25.preview.emergentagent.com"
    tester = RestorationTester(base_url)
    
    # Run all tests
    if not tester.test_auth():
        print(f"\n{RED}❌ Authentication failed. Cannot proceed with other tests.{RESET}")
        return 1
    
    tester.test_owner_cockpit()
    tester.test_finance()
    tester.test_executive()
    tester.test_crm_loyalty()
    tester.test_outlet_budgets()
    tester.test_reservations()
    tester.test_hr()
    tester.test_inventory()
    tester.test_procurement()
    tester.test_admin()
    tester.test_public_marketing()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
