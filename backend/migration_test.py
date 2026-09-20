"""FnB Group ERP - Full Migration Test
Tests all critical endpoints after migration to new environment.
"""
import requests
import sys
from typing import Dict, Any, List

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

BASE_URL = "https://bug-fix-sprint-25.preview.emergentagent.com"
TEST_EMAIL = "admin@fnbgroup.id"
TEST_PASSWORD = "Demo@2026"


class MigrationTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.token = None
        self.errors: List[Dict[str, Any]] = []

    def test_endpoint(self, name: str, method: str, endpoint: str, 
                     expected_status: int, data: Dict = None, 
                     headers: Dict = None) -> tuple[bool, Any]:
        """Test a single endpoint."""
        self.tests_run += 1
        url = f"{BASE_URL}{endpoint}"
        
        # Add auth header if token exists
        if self.token and headers is None:
            headers = {"Authorization": f"Bearer {self.token}"}
        elif self.token and headers:
            headers["Authorization"] = f"Bearer {self.token}"
        
        print(f"\n{BLUE}🔍 Testing: {name}{RESET}")
        print(f"   {method} {endpoint}")
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"{GREEN}✅ PASS - Status: {response.status_code}{RESET}")
                try:
                    return True, response.json()
                except Exception:
                    return True, response.text
            else:
                self.tests_failed += 1
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f"\nResponse: {error_detail}"
                except Exception:
                    error_msg += f"\nResponse: {response.text[:200]}"
                
                self.errors.append({
                    "test": name,
                    "endpoint": endpoint,
                    "error": error_msg
                })
                print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                return False, None
                
        except Exception as e:
            self.tests_failed += 1
            error_msg = f"Exception: {str(e)}"
            self.errors.append({
                "test": name,
                "endpoint": endpoint,
                "error": error_msg
            })
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False, None

    def print_summary(self):
        """Print test summary."""
        print(f"\n{'='*70}")
        print(f"{BLUE}📊 MIGRATION TEST SUMMARY{RESET}")
        print(f"{'='*70}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run * 100)
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*70}")
            print(f"ERRORS DETAIL:")
            print(f"{'='*70}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}Error {i}: {error['test']}{RESET}")
                print(f"Endpoint: {error['endpoint']}")
                print(f"{error['error']}")
        
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*70}")
    print("FnB Group ERP - Full Migration Test")
    print(f"{'='*70}{RESET}\n")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    
    tester = MigrationTester()
    
    # ========================================
    # 1. HEALTH CHECK
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("1. HEALTH CHECK")
    print(f"{'='*70}{RESET}")
    
    success, data = tester.test_endpoint(
        "Backend Health Check",
        "GET",
        "/api/health",
        200
    )
    
    if success and data:
        print(f"{GREEN}   Database: {data.get('data', {}).get('database', 'unknown')}{RESET}")
    
    # ========================================
    # 2. AUTHENTICATION
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("2. AUTHENTICATION")
    print(f"{'='*70}{RESET}")
    
    success, data = tester.test_endpoint(
        "Login",
        "POST",
        "/api/auth/login",
        200,
        data={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if success and data:
        print(f"{BLUE}   Response structure: {list(data.keys())}{RESET}")
        # Try different response structures
        token = data.get("data", {}).get("token") or data.get("token") or data.get("data", {}).get("access_token")
        if token:
            tester.token = token
            print(f"{GREEN}   Token obtained successfully{RESET}")
            user = data.get("data", {}).get("user", {}) or data.get("user", {})
            print(f"{GREEN}   User: {user.get('name')} ({user.get('email')}){RESET}")
            print(f"{GREEN}   Permissions: {len(user.get('permissions', []))} permissions{RESET}")
        else:
            print(f"{RED}   No token in response. Full response:{RESET}")
            print(f"{RED}   {data}{RESET}")
    
    if not tester.token:
        print(f"\n{RED}❌ Cannot proceed without authentication token{RESET}")
        tester.print_summary()
        return 1
    
    # ========================================
    # 3. PORTAL HOME/DASHBOARD ENDPOINTS
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("3. PORTAL HOME/DASHBOARD ENDPOINTS")
    print(f"{'='*70}{RESET}")
    
    # Finance Home
    tester.test_endpoint(
        "Finance Home",
        "GET",
        "/api/finance/home",
        200
    )
    
    # Procurement Workboard (main dashboard)
    tester.test_endpoint(
        "Procurement Workboard",
        "GET",
        "/api/procurement/workboard",
        200
    )
    
    # Inventory Balance (main view)
    tester.test_endpoint(
        "Inventory Balance",
        "GET",
        "/api/inventory/balance",
        200
    )
    
    # Outlet Home
    tester.test_endpoint(
        "Outlet Home",
        "GET",
        "/api/outlet/home",
        200
    )
    
    # ========================================
    # 4. MASTER DATA APIs
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("4. MASTER DATA APIs")
    print(f"{'='*70}{RESET}")
    
    # Items
    success, data = tester.test_endpoint(
        "Master Items",
        "GET",
        "/api/master/items",
        200
    )
    
    if success and data:
        items = data.get("data", [])
        print(f"{GREEN}   Found {len(items)} items{RESET}")
    
    # Vendors
    success, data = tester.test_endpoint(
        "Master Vendors",
        "GET",
        "/api/master/vendors",
        200
    )
    
    if success and data:
        vendors = data.get("data", [])
        print(f"{GREEN}   Found {len(vendors)} vendors{RESET}")
    
    # ========================================
    # 5. ADMIN APIs
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("5. ADMIN APIs")
    print(f"{'='*70}{RESET}")
    
    # Roles
    success, data = tester.test_endpoint(
        "Roles List",
        "GET",
        "/api/admin/roles",
        200
    )
    
    if success and data:
        roles = data.get("data", [])
        print(f"{GREEN}   Found {len(roles)} roles{RESET}")
    
    # ========================================
    # 6. FINANCE APIs
    # ========================================
    print(f"\n{YELLOW}{'='*70}")
    print("6. FINANCE APIs")
    print(f"{'='*70}{RESET}")
    
    # Journals
    success, data = tester.test_endpoint(
        "Journal Entries",
        "GET",
        "/api/finance/journals",
        200
    )
    
    if success and data:
        journals = data.get("data", [])
        print(f"{GREEN}   Found {len(journals)} journal entries{RESET}")
    
    # ========================================
    # SUMMARY
    # ========================================
    success = tester.print_summary()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
