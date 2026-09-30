"""Inventory API Testing - Stock Transfers & Usage Log
Tests for the bug fixes in iteration 30+:
- Stock Transfers collection drift fix (canonical 'transfers' collection)
- Usage Log page implementation
- Stock Transfers workflow (draft -> sent -> received)
"""
import requests
import sys
from datetime import datetime

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class InventoryAPITester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing: {name}{RESET}")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"{GREEN}✅ PASS{RESET}")
                try:
                    return True, response.json()
                except Exception:
                    return True, {}
            else:
                self.tests_failed += 1
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f"\n   Response: {error_detail}"
                except Exception:
                    error_msg += f"\n   Response: {response.text[:200]}"
                self.errors.append({"test": name, "error": error_msg})
                print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            error_msg = f"Exception: {str(e)}"
            self.errors.append({"test": name, "error": error_msg})
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False, {}

    def login(self, email, password):
        """Login and get token"""
        print(f"\n{YELLOW}{'='*60}")
        print("LOGIN")
        print(f"{'='*60}{RESET}")
        success, response = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success:
            # Try different response structures
            token = None
            if 'data' in response and isinstance(response['data'], dict):
                token = response['data'].get('token') or response['data'].get('access_token')
            elif 'token' in response:
                token = response['token']
            elif 'access_token' in response:
                token = response['access_token']
            
            if token:
                self.token = token
                print(f"{GREEN}✅ Login successful, token obtained{RESET}")
                return True
            else:
                print(f"{YELLOW}⚠️  Login returned 200 but no token found{RESET}")
                print(f"   Response keys: {list(response.keys())}")
        print(f"{RED}❌ Login failed{RESET}")
        return False

    def test_stock_transfers(self):
        """Test Stock Transfers endpoints"""
        print(f"\n{YELLOW}{'='*60}")
        print("STOCK TRANSFERS TESTS")
        print(f"{'='*60}{RESET}")
        
        # Test 1: List transfers
        success, response = self.run_test(
            "List Stock Transfers",
            "GET",
            "/api/inventory/transfers?per_page=100",
            200
        )
        
        transfers = []
        if success and 'data' in response:
            transfers = response['data']
            print(f"   Found {len(transfers)} transfers")
            if len(transfers) > 0:
                print(f"   Sample transfer: {transfers[0].get('doc_no', 'N/A')} - Status: {transfers[0].get('status', 'N/A')}")
        
        # Test 2: Get transfer detail (if any exist)
        if transfers:
            transfer_id = transfers[0].get('id')
            if transfer_id:
                self.run_test(
                    "Get Transfer Detail",
                    "GET",
                    f"/api/inventory/transfers/{transfer_id}",
                    200
                )
        
        # Test 3: Create a new transfer
        print(f"\n{BLUE}Creating a new transfer...{RESET}")
        # First, get outlets and items
        success, outlets_resp = self.run_test(
            "Get Outlets for Transfer",
            "GET",
            "/api/master/outlets?per_page=10",
            200
        )
        
        success, items_resp = self.run_test(
            "Get Items for Transfer",
            "GET",
            "/api/inventory/balance?per_page=10",
            200
        )
        
        if outlets_resp.get('data') and items_resp.get('data'):
            outlets = outlets_resp['data']
            items = items_resp['data']
            
            if len(outlets) >= 2 and len(items) >= 1:
                from_outlet = outlets[0]['id']
                to_outlet = outlets[1]['id']
                item = items[0]
                
                transfer_payload = {
                    "from_outlet_id": from_outlet,
                    "to_outlet_id": to_outlet,
                    "lines": [
                        {
                            "item_id": item['item_id'],
                            "item_name": item.get('item_name', 'Test Item'),
                            "qty": 5,
                            "unit": item.get('unit', 'pcs'),
                            "unit_cost": item.get('last_unit_cost', 1000)
                        }
                    ]
                }
                
                success, create_resp = self.run_test(
                    "Create Transfer (Draft)",
                    "POST",
                    "/api/inventory/transfers",
                    200,
                    data=transfer_payload
                )
                
                # Test 4: Send transfer (if created)
                if success and create_resp.get('data'):
                    new_transfer_id = create_resp['data'].get('id')
                    if new_transfer_id:
                        success, send_resp = self.run_test(
                            "Send Transfer (Draft -> Sent)",
                            "POST",
                            f"/api/inventory/transfers/{new_transfer_id}/send",
                            200
                        )
                        
                        # Test 5: Receive transfer
                        if success:
                            self.run_test(
                                "Receive Transfer (Sent -> Received)",
                                "POST",
                                f"/api/inventory/transfers/{new_transfer_id}/receive",
                                200
                            )
        
        return transfers

    def test_usage_log(self):
        """Test Usage Log (inventory movements)"""
        print(f"\n{YELLOW}{'='*60}")
        print("USAGE LOG TESTS")
        print(f"{'='*60}{RESET}")
        
        # Test 1: List movements
        success, response = self.run_test(
            "List Inventory Movements",
            "GET",
            "/api/inventory/movements?per_page=200",
            200
        )
        
        movements = []
        if success and 'data' in response:
            movements = response['data']
            print(f"   Found {len(movements)} movements")
            
            # Count by type
            types = {}
            for m in movements:
                mt = m.get('movement_type', 'unknown')
                types[mt] = types.get(mt, 0) + 1
            
            print(f"   Movement types: {types}")
        
        return movements

    def test_stock_check(self):
        """Test Stock Check (inventory balance)"""
        print(f"\n{YELLOW}{'='*60}")
        print("STOCK CHECK TESTS")
        print(f"{'='*60}{RESET}")
        
        # Test 1: Get stock balance
        success, response = self.run_test(
            "Get Stock Balance",
            "GET",
            "/api/inventory/balance?per_page=100",
            200
        )
        
        balance = []
        if success and 'data' in response:
            balance = response['data']
            print(f"   Found {len(balance)} items in stock")
            
            # Calculate total value
            total_value = sum(b.get('total_value', 0) for b in balance)
            print(f"   Total stock value: Rp {total_value:,.0f}")
        
        return balance

    def print_summary(self):
        """Print test summary"""
        print(f"\n{BLUE}{'='*60}")
        print("📊 TEST SUMMARY")
        print(f"{'='*60}{RESET}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        if self.tests_run > 0:
            print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*60}")
            print("ERRORS DETAIL:")
            print(f"{'='*60}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}Error {i}: {error['test']}{RESET}")
                print(f"{error['error']}")
        
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*60}")
    print("FnB Group ERP - Inventory API Testing")
    print("Testing: Stock Transfers, Usage Log, Stock Check")
    print(f"{'='*60}{RESET}\n")
    
    tester = InventoryAPITester()
    
    # Login
    if not tester.login("admin@fnbgroup.id", "Demo@2026"):
        print(f"{RED}❌ Login failed, cannot proceed with tests{RESET}")
        return 1
    
    # Run tests
    transfers = tester.test_stock_transfers()
    movements = tester.test_usage_log()
    balance = tester.test_stock_check()
    
    # Validate expected data
    print(f"\n{YELLOW}{'='*60}")
    print("DATA VALIDATION")
    print(f"{'='*60}{RESET}")
    
    # Expected: ~15 transfers
    if len(transfers) >= 10:
        print(f"{GREEN}✅ Stock Transfers count OK: {len(transfers)} (expected ~15){RESET}")
    else:
        print(f"{RED}❌ Stock Transfers count LOW: {len(transfers)} (expected ~15){RESET}")
        tester.tests_failed += 1
    
    # Expected: ~192 movements
    if len(movements) >= 150:
        print(f"{GREEN}✅ Usage Log count OK: {len(movements)} (expected ~192){RESET}")
    else:
        print(f"{YELLOW}⚠️  Usage Log count: {len(movements)} (expected ~192){RESET}")
    
    # Expected: positive stock values
    if len(balance) > 0:
        print(f"{GREEN}✅ Stock Check has data: {len(balance)} items{RESET}")
    else:
        print(f"{RED}❌ Stock Check is empty{RESET}")
        tester.tests_failed += 1
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
