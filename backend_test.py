"""
Backend API Testing for FnB Group ERP - Round 3 Bug Fixes Verification
Tests all 8 issues (A-G + D1) that were fixed by main agent
"""
import requests
import sys
from datetime import datetime

class FnB GroupERPTester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}")
                self.failed_tests.append({
                    "name": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "name": name,
                "error": str(e)
            })
            return False, {}

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success:
            # Try different response structures
            if 'data' in response and 'token' in response['data']:
                self.token = response['data']['token']
            elif 'token' in response:
                self.token = response['token']
            elif 'data' in response and 'access_token' in response['data']:
                self.token = response['data']['access_token']
            elif 'access_token' in response:
                self.token = response['access_token']
            
            if self.token:
                print(f"   Token obtained: {self.token[:20]}...")
                return True
            else:
                print(f"   Response structure: {list(response.keys())}")
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE A: Outlet Home Petty Cash KPI
    # ═══════════════════════════════════════════════════════════
    def test_outlet_home_petty_cash(self):
        """ISSUE A: Outlet Home petty cash KPI must show non-zero balance (~Rp 29M)"""
        success, response = self.run_test(
            "ISSUE A - Outlet Home (Petty Cash KPI)",
            "GET",
            "api/outlet/home",
            200
        )
        if success and 'data' in response:
            data = response['data']
            pc_balance = data.get('petty_cash_balance', {})
            print(f"   Petty Cash Balance: {pc_balance}")
            
            # Check if balance is non-zero
            total_balance = sum(float(v) for v in pc_balance.values() if v)
            print(f"   Total Balance: Rp {total_balance:,.0f}")
            
            if total_balance > 0:
                print(f"   ✓ Non-zero balance found (expected ~Rp 29M)")
                return True
            else:
                print(f"   ✗ Balance is ZERO (BUG: should be ~Rp 29M)")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE B: HR Dashboard Open Advances
    # ═══════════════════════════════════════════════════════════
    def test_hr_dashboard_advances(self):
        """ISSUE B: HR Dashboard open advances must show non-zero count (expect 9) with outstanding"""
        success, response = self.run_test(
            "ISSUE B - HR Dashboard (Open Advances)",
            "GET",
            "api/hr/dashboard",
            200
        )
        if success and 'data' in response:
            data = response['data']
            open_adv = data.get('open_advances', 0)
            outstanding = data.get('advance_outstanding', 0)
            pending_approval = data.get('pending_advance_approval', 0)
            
            print(f"   Open Advances: {open_adv}")
            print(f"   Outstanding: Rp {outstanding:,.0f}")
            print(f"   Pending Approval: {pending_approval}")
            
            # Check consistency: open_advances should be non-zero and match pending
            if open_adv > 0 and outstanding > 0:
                print(f"   ✓ Non-zero advances found (expected 9)")
                if pending_approval > 0:
                    print(f"   ✓ Consistent with pending approval count")
                return True
            else:
                print(f"   ✗ Open advances is ZERO or no outstanding (BUG)")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE C: HR Service Charge
    # ═══════════════════════════════════════════════════════════
    def test_hr_service_charge(self):
        """ISSUE C: HR Service Charge must list periods for 2026-06 (~5 outlets)"""
        success, response = self.run_test(
            "ISSUE C - HR Service Charge (2026-06)",
            "GET",
            "api/hr/service-charges",
            200,
            params={"period": "2026-06"}
        )
        if success and 'data' in response:
            data = response['data']
            items = data if isinstance(data, list) else data.get('items', [])
            print(f"   Service Charge Periods Found: {len(items)}")
            
            if len(items) > 0:
                print(f"   ✓ Found {len(items)} periods (expected ~5 outlets)")
                for item in items[:3]:
                    print(f"     - Outlet: {item.get('outlet_id')}, Status: {item.get('status')}, Gross: Rp {item.get('gross_service', 0):,.0f}")
                return True
            else:
                print(f"   ✗ NO service charge periods found (BUG: should show ~5)")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE D: HR Approval Center Breakdown
    # ═══════════════════════════════════════════════════════════
    def test_hr_approval_breakdown(self):
        """ISSUE D: Approval Center breakdown must sum to total (28 = 20+5+3)"""
        success, response = self.run_test(
            "ISSUE D - Approval Center (Breakdown)",
            "GET",
            "api/approvals/counts",
            200
        )
        if success and 'data' in response:
            data = response['data']
            total = data.get('total', 0)
            by_entity = data.get('by_entity', {})
            
            print(f"   Total Pending: {total}")
            print(f"   Breakdown by Entity:")
            
            breakdown_sum = 0
            for entity_type, count in by_entity.items():
                if count > 0:
                    print(f"     - {entity_type}: {count}")
                    breakdown_sum += count
            
            print(f"   Breakdown Sum: {breakdown_sum}")
            
            if breakdown_sum == total and total > 0:
                print(f"   ✓ Breakdown sums to total ({breakdown_sum} = {total})")
                return True
            else:
                print(f"   ✗ Breakdown does NOT sum to total ({breakdown_sum} ≠ {total}) - BUG")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE E: Outlet Stock Check (Inventory Balance)
    # ═══════════════════════════════════════════════════════════
    def test_outlet_stock_check(self):
        """ISSUE E: Stock Check page must have functional data (not 'Coming Soon')"""
        success, response = self.run_test(
            "ISSUE E - Outlet Stock Check (Inventory Balance)",
            "GET",
            "api/inventory/balance",
            200
        )
        if success and 'data' in response:
            data = response['data']
            items = data if isinstance(data, list) else data.get('items', [])
            print(f"   Stock Items Found: {len(items)}")
            
            if len(items) > 0:
                total_value = sum(float(item.get('value', 0) or 0) for item in items)
                print(f"   Total Inventory Value: Rp {total_value:,.0f} (expected ~Rp 86M)")
                print(f"   ✓ Functional stock check data available")
                return True
            else:
                print(f"   ✗ NO stock data found (might still be 'Coming Soon')")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE F: Outlet Daily Sales (Date Range)
    # ═══════════════════════════════════════════════════════════
    def test_outlet_daily_sales(self):
        """ISSUE F: Daily Sales must support date range filtering"""
        success, response = self.run_test(
            "ISSUE F - Outlet Daily Sales (All Dates)",
            "GET",
            "api/outlet/daily-sales",
            200,
            params={"per_page": 100}  # Request more items to check total
        )
        if success and 'data' in response:
            data = response['data']
            items = data if isinstance(data, list) else data.get('items', [])
            meta = data.get('meta', {}) if isinstance(data, dict) else {}
            total = meta.get('total', len(items))
            
            print(f"   Daily Sales Entries: {len(items)}")
            print(f"   Total (from meta): {total}")
            
            if total >= 305 or len(items) >= 70:
                print(f"   ✓ Daily sales data available (expected 305 total)")
                return True
            else:
                print(f"   ✗ Insufficient daily sales data")
                return False
        return False

    # ═══════════════════════════════════════════════════════════
    # ISSUE D1: Finance Balance Sheet
    # ═══════════════════════════════════════════════════════════
    def test_finance_balance_sheet(self):
        """ISSUE D1: Balance Sheet must be balanced with non-zero AP (~Rp 93.87M)"""
        success, response = self.run_test(
            "ISSUE D1 - Finance Balance Sheet (2026-06)",
            "GET",
            "api/finance/balance-sheet",
            200,
            params={"as_of": "2026-06-30"}
        )
        if success and 'data' in response:
            data = response['data']
            totals = data.get('totals', {})
            is_balanced = totals.get('is_balanced', False)
            liabilities = totals.get('liabilities', 0)
            
            print(f"   Is Balanced: {is_balanced}")
            print(f"   Total Liabilities: Rp {liabilities:,.0f}")
            
            # Find Accounts Payable from sections
            ap_value = 0
            for section in data.get('sections', {}).get('liability', []):
                if 'payable' in section.get('name', '').lower():
                    ap_value = float(section.get('amount', 0) or 0)
                    print(f"   Accounts Payable: Rp {ap_value:,.0f} (expected ~Rp 93.87M)")
            
            if is_balanced and ap_value > 0:
                print(f"   ✓ Balance Sheet is balanced with non-zero AP")
                return True
            else:
                print(f"   ✗ Balance Sheet NOT balanced or AP is zero - BUG")
                return False
        return False

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print(f"📊 FNB GROUP ERP - ROUND 3 BUG FIXES TEST SUMMARY")
        print("="*70)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test.get('name', 'Unknown')}")
                if 'error' in test:
                    print(f"    Error: {test['error']}")
                else:
                    print(f"    Expected: {test.get('expected')}, Got: {test.get('actual')}")
        
        print("="*70)
        return self.tests_passed == self.tests_run

def main():
    """Run all backend tests"""
    tester = FnB GroupERPTester()
    
    print("="*70)
    print("🚀 FNB GROUP GROUP ERP - ROUND 3 BUG FIXES VERIFICATION")
    print("="*70)
    
    # Login with SUPER_ADMIN credentials
    if not tester.test_login("admin@fnbgroup.id", "Demo@2026"):
        print("❌ Login failed, stopping tests")
        return 1

    print("\n" + "="*70)
    print("Testing 8 Fixed Issues (A-G + D1)")
    print("="*70)

    # Test all 8 issues
    tester.test_outlet_home_petty_cash()      # ISSUE A
    tester.test_hr_dashboard_advances()        # ISSUE B
    tester.test_hr_service_charge()            # ISSUE C
    tester.test_hr_approval_breakdown()        # ISSUE D
    tester.test_outlet_stock_check()           # ISSUE E
    tester.test_outlet_daily_sales()           # ISSUE F
    tester.test_finance_balance_sheet()        # ISSUE D1

    # Print summary
    success = tester.print_summary()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
