"""FnB Group ERP - API Integration Test
Tests backend endpoints for Phase 9C+ AI Variance Explainer and related inventory endpoints.
"""
import requests
import sys
from datetime import datetime

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class APITester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, check_envelope=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token and 'Authorization' not in test_headers:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing: {name}{RESET}")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            print(f"   Status: {response.status_code}")
            
            # Check status code
            if response.status_code != expected_status:
                self.tests_failed += 1
                error_msg = f"Expected status {expected_status}, got {response.status_code}"
                try:
                    error_msg += f"\n   Response: {response.json()}"
                except Exception:
                    error_msg += f"\n   Response: {response.text[:200]}"
                self.errors.append({"test": name, "error": error_msg})
                print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                return False, {}

            # Try to parse JSON response
            try:
                response_data = response.json()
                print(f"   Response keys: {list(response_data.keys())}")
                
                # Check envelope structure if required
                if check_envelope:
                    if 'success' not in response_data:
                        self.tests_failed += 1
                        error_msg = "Response missing 'success' field in envelope"
                        self.errors.append({"test": name, "error": error_msg})
                        print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                        return False, response_data
                    
                    if 'data' not in response_data:
                        self.tests_failed += 1
                        error_msg = "Response missing 'data' field in envelope"
                        self.errors.append({"test": name, "error": error_msg})
                        print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                        return False, response_data
                
                self.tests_passed += 1
                print(f"{GREEN}✅ PASS - {name}{RESET}")
                return True, response_data
                
            except ValueError:
                # Not JSON response
                if expected_status == 200:
                    self.tests_failed += 1
                    error_msg = f"Expected JSON response, got: {response.text[:200]}"
                    self.errors.append({"test": name, "error": error_msg})
                    print(f"{RED}❌ FAIL - {error_msg}{RESET}")
                    return False, {}
                else:
                    self.tests_passed += 1
                    print(f"{GREEN}✅ PASS - {name}{RESET}")
                    return True, {}

        except requests.exceptions.Timeout:
            self.tests_failed += 1
            error_msg = "Request timeout (30s)"
            self.errors.append({"test": name, "error": error_msg})
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False, {}
        except Exception as e:
            self.tests_failed += 1
            error_msg = f"Exception: {str(e)}"
            self.errors.append({"test": name, "error": error_msg})
            print(f"{RED}❌ FAIL - {error_msg}{RESET}")
            return False, {}

    def test_login(self):
        """Test login and get token"""
        print(f"\n{YELLOW}{'='*60}")
        print("AUTHENTICATION TEST")
        print(f"{'='*60}{RESET}")
        
        success, response = self.run_test(
            "Login with admin credentials",
            "POST",
            "api/auth/login",
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
        print("HEALTH CHECK TEST")
        print(f"{'='*60}{RESET}")
        
        success, response = self.run_test(
            "Health endpoint",
            "GET",
            "api/health",
            200,
            check_envelope=False  # Health endpoint may not use envelope
        )
        return success

    def test_ai_variance_invalid_session(self):
        """Test AI variance endpoint with invalid session ID"""
        print(f"\n{YELLOW}{'='*60}")
        print("AI VARIANCE EXPLAINER - INVALID SESSION TEST")
        print(f"{'='*60}{RESET}")
        
        success, response = self.run_test(
            "AI Variance with invalid session ID",
            "POST",
            "api/ai/opname/invalid-session-id-12345/explain-variance",
            200,  # Should return 200, not 404 or 500
            data={}
        )
        
        if success:
            # Check that error is in data envelope
            data = response.get('data', {})
            if 'error' in data:
                print(f"{GREEN}   ✓ Error properly returned in data envelope: {data['error']}{RESET}")
                if "tidak ditemukan" in data['error'].lower():
                    print(f"{GREEN}   ✓ Error message is correct (session not found){RESET}")
                else:
                    print(f"{YELLOW}   ⚠ Error message unexpected: {data['error']}{RESET}")
            else:
                print(f"{YELLOW}   ⚠ No error field in data envelope{RESET}")
        
        return success

    def test_inventory_endpoints(self):
        """Test inventory endpoints"""
        print(f"\n{YELLOW}{'='*60}")
        print("INVENTORY ENDPOINTS TEST")
        print(f"{'='*60}{RESET}")
        
        results = []
        
        # Test opname list
        success, response = self.run_test(
            "GET /api/inventory/opname",
            "GET",
            "api/inventory/opname",
            200
        )
        results.append(success)
        if success:
            data = response.get('data', [])
            print(f"   ℹ Found {len(data) if isinstance(data, list) else 'N/A'} opname sessions")
        
        # Test low-stock
        success, response = self.run_test(
            "GET /api/inventory/low-stock",
            "GET",
            "api/inventory/low-stock",
            200
        )
        results.append(success)
        if success:
            data = response.get('data', [])
            print(f"   ℹ Found {len(data) if isinstance(data, list) else 'N/A'} low stock items")
        
        # Test balance-matrix
        success, response = self.run_test(
            "GET /api/inventory/balance-matrix",
            "GET",
            "api/inventory/balance-matrix",
            200
        )
        results.append(success)
        if success:
            data = response.get('data', {})
            print(f"   ℹ Balance matrix data keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
        
        return all(results)

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"{BLUE}📊 TEST SUMMARY{RESET}")
        print(f"{'='*60}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run * 100)
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*60}")
            print(f"ERRORS DETAIL:")
            print(f"{'='*60}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}Error {i}: {error['test']}{RESET}")
                print(f"{error['error']}")
        
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*60}")
    print("FnB Group ERP - API Integration Test")
    print("Phase 9C+ AI Variance Explainer + Inventory Endpoints")
    print(f"{'='*60}{RESET}\n")
    
    tester = APITester()
    
    # Test sequence
    if not tester.test_login():
        print(f"\n{RED}❌ Login failed - cannot proceed with authenticated tests{RESET}")
        tester.print_summary()
        return 1
    
    # Health check (no auth required)
    tester.test_health()
    
    # AI Variance endpoint with invalid session
    tester.test_ai_variance_invalid_session()
    
    # Inventory endpoints (require auth)
    tester.test_inventory_endpoints()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
