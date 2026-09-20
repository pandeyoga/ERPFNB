"""Phase D4 Smoke Test — Backend API Regression Check 2026-05-26.

Tests core endpoints to ensure no regressions from Phase D4 UX refactoring.
Phase D4 was frontend-only (no backend changes), so all APIs should work as before.

Endpoints tested:
- POST /api/auth/login
- GET /api/health
- GET /api/finance/periods
- GET /api/finance/anomalies
- GET /api/hr/service-charge
- GET /api/admin/cms/brands
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

class PhaseD4SmokeTest:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing: {name}{RESET}")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"{GREEN}✅ PASS - {name}{RESET}")
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
                
                self.errors.append({
                    "test": name,
                    "error": error_msg
                })
                print(f"{RED}❌ FAIL - {name}: {error_msg}{RESET}")
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            error_msg = f"Exception: {str(e)}"
            self.errors.append({
                "test": name,
                "error": error_msg
            })
            print(f"{RED}❌ FAIL - {name}: {error_msg}{RESET}")
            return False, {}

    def test_login(self):
        """Test login and get token"""
        print(f"\n{YELLOW}{'='*60}")
        print("AUTH TEST")
        print(f"{'='*60}{RESET}")
        
        success, response = self.run_test(
            "Login (admin@fnbgroup.id)",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "admin@fnbgroup.id", "password": "Demo@2026"}
        )
        
        if success and response.get('data', {}).get('access_token'):
            self.token = response['data']['access_token']
            print(f"{GREEN}   ✓ Token acquired{RESET}")
            return True
        else:
            print(f"{RED}   ✗ Failed to get token{RESET}")
            return False

    def test_health(self):
        """Test health endpoint"""
        print(f"\n{YELLOW}{'='*60}")
        print("HEALTH CHECK")
        print(f"{'='*60}{RESET}")
        
        self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )

    def test_finance_endpoints(self):
        """Test finance endpoints"""
        print(f"\n{YELLOW}{'='*60}")
        print("FINANCE ENDPOINTS")
        print(f"{'='*60}{RESET}")
        
        self.run_test(
            "Finance - List Periods",
            "GET",
            "/api/finance/periods",
            200,
            auth_required=True
        )
        
        self.run_test(
            "Finance - List Anomalies",
            "GET",
            "/api/finance/anomalies",
            200,
            auth_required=True
        )

    def test_hr_endpoints(self):
        """Test HR endpoints"""
        print(f"\n{YELLOW}{'='*60}")
        print("HR ENDPOINTS")
        print(f"{'='*60}{RESET}")
        
        # Try service-charge endpoint
        success, _ = self.run_test(
            "HR - Service Charge List",
            "GET",
            "/api/hr/service-charge",
            200,
            auth_required=True
        )
        
        # If service-charge fails, try payroll as fallback
        if not success:
            self.run_test(
                "HR - Payroll List (fallback)",
                "GET",
                "/api/hr/payroll",
                200,
                auth_required=True
            )

    def test_cms_endpoints(self):
        """Test CMS endpoints"""
        print(f"\n{YELLOW}{'='*60}")
        print("CMS ENDPOINTS")
        print(f"{'='*60}{RESET}")
        
        # Try brands endpoint
        success, _ = self.run_test(
            "CMS - Brands List",
            "GET",
            "/api/admin/cms/brands",
            200,
            auth_required=True
        )
        
        # If brands fails, try outlets as fallback
        if not success:
            self.run_test(
                "CMS - Outlets List (fallback)",
                "GET",
                "/api/admin/cms/outlets",
                200,
                auth_required=True
            )

    def print_summary(self):
        """Print test summary"""
        print(f"\n{BLUE}{'='*60}")
        print("📊 SMOKE TEST SUMMARY")
        print(f"{'='*60}{RESET}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
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
    print("Phase D4 Backend Smoke Test")
    print("Testing: No regressions from UX refactoring")
    print(f"{'='*60}{RESET}\n")
    
    tester = PhaseD4SmokeTest()
    
    # Run tests in sequence
    if not tester.test_login():
        print(f"\n{RED}❌ Login failed - cannot proceed with authenticated tests{RESET}")
        tester.print_summary()
        return 1
    
    tester.test_health()
    tester.test_finance_endpoints()
    tester.test_hr_endpoints()
    tester.test_cms_endpoints()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
