"""Tour Phase 5 API Testing - Backend Endpoints

Tests:
1. Health check: GET /api/health
2. Login: POST /api/auth/login
3. Tour analytics: GET /api/tour-analytics/summary
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


class TourPhase5APITester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        if self.token and 'Authorization' not in headers:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing {name}...{RESET}")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
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
                    return True, {}
            else:
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
            error_msg = f"Exception: {str(e)}"
            self.errors.append({"test": name, "error": error_msg})
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        if success and response.get('success'):
            print(f"   {GREEN}Health data: {response.get('data', {})}{RESET}")
        return success

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and response.get('success'):
            token_data = response.get('data', {})
            if 'access_token' in token_data:
                self.token = token_data['access_token']
                print(f"   {GREEN}Token obtained successfully{RESET}")
                return True
            else:
                error_msg = "No access_token in response"
                self.errors.append({"test": "Login", "error": error_msg})
                print(f"   {RED}{error_msg}{RESET}")
                return False
        return False

    def test_tour_analytics_summary(self):
        """Test tour analytics summary endpoint"""
        if not self.token:
            error_msg = "No auth token available"
            self.errors.append({"test": "Tour Analytics Summary", "error": error_msg})
            print(f"\n{RED}⚠️  Skipping Tour Analytics Summary - {error_msg}{RESET}")
            return False
        
        success, response = self.run_test(
            "Tour Analytics Summary",
            "GET",
            "/api/tour-analytics/summary?days=30",
            200
        )
        if success and response.get('success'):
            data = response.get('data', {})
            print(f"   {GREEN}Analytics data keys: {list(data.keys())}{RESET}")
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{BLUE}{'='*60}")
        print("📊 TEST SUMMARY - Tour Phase 5 Backend API")
        print(f"{'='*60}{RESET}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {len(self.errors)}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run * 100)
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*60}")
            print("ERRORS DETAIL:")
            print(f"{'='*60}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}Error {i}: {error['test']}{RESET}")
                print(f"{error['error']}")
        
        return len(self.errors) == 0


def main():
    print(f"{BLUE}{'='*60}")
    print("Tour Phase 5 - Backend API Testing")
    print(f"{'='*60}{RESET}\n")
    
    tester = TourPhase5APITester()
    
    # Test 1: Health check (no auth required)
    tester.test_health()
    
    # Test 2: Login to get auth token
    if not tester.test_login("admin@fnbgroup.id", "Demo@2026"):
        print(f"\n{RED}❌ Login failed, cannot proceed with authenticated tests{RESET}")
    else:
        # Test 3: Tour analytics summary (requires auth)
        tester.test_tour_analytics_summary()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
