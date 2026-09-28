"""Phase D UX Optimization - Backend API Smoke Tests.

This is a regression test suite to ensure NO backend functionality was broken
during the Phase D UX/IA refactoring (hub consolidations, route redirects, etc.).

Tests:
- Auth login
- Health check
- Inventory endpoints (balance, movements, transfers, adjustments)
- Master data endpoints (items, vendors)
"""
import sys
import requests
from typing import Dict, Any

# Backend URL from .env
BASE_URL = "https://bug-fix-sprint-25.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "admin@fnbgroup.id"
TEST_PASSWORD = "Demo@2026"

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RESET = "\033[0m"


class PhaseDTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.token = None
        self.errors = []

    def test_api(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: Dict[str, Any] = None, params: Dict[str, Any] = None) -> bool:
        """Run a single API test."""
        self.tests_run += 1
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        print(f"\n{BLUE}🔍 Test {self.tests_run}: {name}{RESET}")
        print(f"   {method} {endpoint}")

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Check status code
            if response.status_code != expected_status:
                self.tests_failed += 1
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                self.errors.append({"test": name, "error": error_msg, "response": response.text[:200]})
                print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                print(f"   Response: {response.text[:200]}")
                return False

            # Check response structure (FnB ERP envelope)
            try:
                json_data = response.json()
                if "success" not in json_data or "data" not in json_data:
                    self.tests_failed += 1
                    error_msg = "Response missing FnB ERP envelope structure (success, data, errors, meta)"
                    self.errors.append({"test": name, "error": error_msg})
                    print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                    return False
            except Exception as e:
                self.tests_failed += 1
                error_msg = f"Invalid JSON response: {str(e)}"
                self.errors.append({"test": name, "error": error_msg})
                print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                return False

            self.tests_passed += 1
            print(f"{GREEN}✅ PASS - Status {response.status_code}, valid envelope{RESET}")
            return True

        except requests.exceptions.RequestException as e:
            self.tests_failed += 1
            error_msg = f"Request failed: {str(e)}"
            self.errors.append({"test": name, "error": error_msg})
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False

    def run_tests(self):
        """Run all Phase D smoke tests."""
        print(f"{BLUE}{'='*70}")
        print("Phase D UX Optimization - Backend API Smoke Tests")
        print(f"{'='*70}{RESET}\n")
        print(f"Base URL: {BASE_URL}")
        print(f"Test User: {TEST_EMAIL}\n")

        # Test 1: Login
        print(f"\n{YELLOW}{'='*70}")
        print("Authentication")
        print(f"{'='*70}{RESET}")
        
        if self.test_api(
            "Login with admin credentials",
            "POST",
            "/auth/login",
            200,
            data={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        ):
            # Extract token from response
            try:
                response = requests.post(
                    f"{BASE_URL}/auth/login",
                    json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                    timeout=10
                )
                json_data = response.json()
                self.token = json_data.get("data", {}).get("access_token")
                if self.token:
                    print(f"{GREEN}   ✓ Token acquired{RESET}")
                else:
                    print(f"{RED}   ✗ No access_token in response{RESET}")
            except Exception as e:
                print(f"{RED}   ✗ Failed to extract token: {str(e)}{RESET}")

        # Test 2: Health check
        print(f"\n{YELLOW}{'='*70}")
        print("Health Check")
        print(f"{'='*70}{RESET}")
        
        self.test_api("Health endpoint", "GET", "/health", 200)

        # Test 3-6: Inventory endpoints
        print(f"\n{YELLOW}{'='*70}")
        print("Inventory Endpoints")
        print(f"{'='*70}{RESET}")
        
        self.test_api("Inventory balance", "GET", "/inventory/balance", 200)
        self.test_api("Inventory movements", "GET", "/inventory/movements", 200)
        self.test_api("Inventory transfers", "GET", "/inventory/transfers", 200)
        self.test_api("Inventory adjustments", "GET", "/inventory/adjustments", 200)

        # Test 7-8: Master data endpoints
        print(f"\n{YELLOW}{'='*70}")
        print("Master Data Endpoints")
        print(f"{'='*70}{RESET}")
        
        self.test_api("Master items (paginated)", "GET", "/master/items", 200, params={"per_page": 5})
        self.test_api("Master vendors (paginated)", "GET", "/master/vendors", 200, params={"per_page": 5})

    def print_summary(self):
        """Print test summary."""
        print(f"\n{BLUE}{'='*70}")
        print("📊 TEST SUMMARY")
        print(f"{'='*70}{RESET}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*70}")
            print("ERRORS DETAIL:")
            print(f"{'='*70}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}Error {i}: {error['test']}{RESET}")
                print(f"  {error['error']}")
                if "response" in error:
                    print(f"  Response: {error['response']}")
        
        return self.tests_failed == 0


def main():
    tester = PhaseDTester()
    tester.run_tests()
    success = tester.print_summary()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
