"""IDOR Security Fix Validation - Leave Endpoints (P0 Security Audit)

Tests the JUST-APPLIED IDOR fix in /api/hr/leaves endpoints where ANY authenticated
user could previously read ANOTHER employee's leave data/PII.

Fix: Added _assert_can_view_employee_leave(user, employee_id) guard that:
- Allows access if employee_id == user['id'] (owner)
- OR user has '*' permission (SUPER_ADMIN)
- OR user has any of ('hr.leave.approve', 'hr.leave.read', 'hr.employee.read')
- Otherwise raises ForbiddenError -> HTTP 403 (code: LEAVE_OWNERSHIP_REQUIRED)

Test Coverage:
1. IDOR FIX - GET /api/hr/leaves/summary/{employee_id}
2. IDOR FIX - GET /api/hr/leaves/{leave_id}
3. REGRESSION - Core leave lifecycle still works
4. REGRESSION - List endpoint scoping
5. NEGATIVE - Quota enforcement
"""
import sys
import time
import requests
from typing import Optional

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

BASE_URL = "https://zen-swartz-5.preview.emergentagent.com"
PASSWORD = "Demo@2026"

# Test users
ADMIN_EMAIL = "admin@fnbgroup.id"  # SUPER_ADMIN (perms '*')
FINANCE_EMAIL = "finance@fnbgroup.id"  # NON-HR user
EXECUTIVE_EMAIL = "executive@fnbgroup.id"  # NON-HR user


class IDORSecurityTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []
        self.tokens = {}
        self.user_ids = {}
        self.created_leave_ids = []

    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result."""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"{GREEN}✅ PASS{RESET} - {name}")
            if details:
                print(f"   {details}")
        else:
            self.tests_failed += 1
            self.errors.append({"test": name, "details": details})
            print(f"{RED}❌ FAIL{RESET} - {name}")
            if details:
                print(f"   {RED}{details}{RESET}")

    def login(self, email: str) -> Optional[dict]:
        """Login and return token + user data."""
        print(f"\n{BLUE}🔐 Logging in as {email}...{RESET}")
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": PASSWORD},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    token = data["data"]["access_token"]
                    user = data["data"]["user"]
                    self.tokens[email] = token
                    self.user_ids[email] = user["id"]
                    print(f"{GREEN}✅ Logged in successfully - user_id: {user['id']}{RESET}")
                    return {"token": token, "user": user}
            print(f"{RED}❌ Login failed: {response.status_code} - {response.text}{RESET}")
            return None
        except Exception as e:
            print(f"{RED}❌ Login error: {str(e)}{RESET}")
            return None

    def get_headers(self, email: str) -> dict:
        """Get auth headers for a user."""
        return {
            "Authorization": f"Bearer {self.tokens[email]}",
            "Content-Type": "application/json"
        }

    def test_summary_idor_owner(self):
        """Test 1a: Owner requesting own summary => 200"""
        print(f"\n{BLUE}📋 Test 1a: GET /api/hr/leaves/summary/{{employee_id}} - Owner access{RESET}")
        try:
            employee_id = self.user_ids[FINANCE_EMAIL]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/summary/{employee_id}",
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}, Employee: {employee_id}"
            if passed:
                data = response.json()
                details += f", Data: {data.get('success', False)}"
            self.log_test("Summary IDOR - Owner access", passed, details)
        except Exception as e:
            self.log_test("Summary IDOR - Owner access", False, str(e))

    def test_summary_idor_cross_user(self):
        """Test 1b: Non-HR requesting another user's summary => 403 (LEAVE_OWNERSHIP_REQUIRED)"""
        print(f"\n{BLUE}📋 Test 1b: GET /api/hr/leaves/summary/{{employee_id}} - Cross-user IDOR attempt{RESET}")
        try:
            # Executive trying to access Finance's summary
            finance_id = self.user_ids[FINANCE_EMAIL]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/summary/{finance_id}",
                headers=self.get_headers(EXECUTIVE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 403
            data = response.json() if response.status_code in [403, 400] else {}
            error_code = ""
            if not data.get("success", True):
                errors = data.get("errors", [])
                if errors:
                    error_code = errors[0].get("code", "")
            
            details = f"Status: {response.status_code}, Code: {error_code}"
            if passed and error_code == "LEAVE_OWNERSHIP_REQUIRED":
                details += " ✓ Correct error code"
            elif passed:
                details += f" ⚠️ Expected code LEAVE_OWNERSHIP_REQUIRED, got {error_code}"
            
            self.log_test("Summary IDOR - Cross-user blocked", passed, details)
        except Exception as e:
            self.log_test("Summary IDOR - Cross-user blocked", False, str(e))

    def test_summary_idor_super_admin(self):
        """Test 1c: SUPER_ADMIN requesting any employee => 200"""
        print(f"\n{BLUE}📋 Test 1c: GET /api/hr/leaves/summary/{{employee_id}} - SUPER_ADMIN access{RESET}")
        try:
            finance_id = self.user_ids[FINANCE_EMAIL]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/summary/{finance_id}",
                headers=self.get_headers(ADMIN_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}, Target: {finance_id}"
            self.log_test("Summary IDOR - SUPER_ADMIN access", passed, details)
        except Exception as e:
            self.log_test("Summary IDOR - SUPER_ADMIN access", False, str(e))

    def test_summary_idor_no_auth(self):
        """Test 1d: No auth token => 401"""
        print(f"\n{BLUE}📋 Test 1d: GET /api/hr/leaves/summary/{{employee_id}} - No auth{RESET}")
        try:
            finance_id = self.user_ids[FINANCE_EMAIL]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/summary/{finance_id}",
                timeout=10
            )
            passed = response.status_code == 401
            details = f"Status: {response.status_code}"
            self.log_test("Summary IDOR - No auth blocked", passed, details)
        except Exception as e:
            self.log_test("Summary IDOR - No auth blocked", False, str(e))

    def test_leave_detail_idor_create(self):
        """Test 2a: Create a leave as finance@fnbgroup.id"""
        print(f"\n{BLUE}📋 Test 2a: POST /api/hr/leaves - Create leave as finance{RESET}")
        try:
            payload = {
                "leave_type": "annual",
                "start_date": "2026-08-01",
                "end_date": "2026-08-02",
                "notes": "IDOR security test leave"
            }
            response = requests.post(
                f"{BASE_URL}/api/hr/leaves",
                json=payload,
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code in [200, 201]
            if passed:
                data = response.json()
                if data.get("success") and data.get("data"):
                    leave_id = data["data"].get("id")
                    self.created_leave_ids.append(leave_id)
                    details = f"Status: {response.status_code}, Leave ID: {leave_id}"
                else:
                    passed = False
                    details = f"Status: {response.status_code}, No leave ID in response"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
            
            self.log_test("Leave Detail IDOR - Create leave", passed, details)
        except Exception as e:
            self.log_test("Leave Detail IDOR - Create leave", False, str(e))

    def test_leave_detail_idor_owner(self):
        """Test 2b: Owner (finance) GET that leave => 200"""
        print(f"\n{BLUE}📋 Test 2b: GET /api/hr/leaves/{{leave_id}} - Owner access{RESET}")
        if not self.created_leave_ids:
            self.log_test("Leave Detail IDOR - Owner access", False, "No leave created in previous test")
            return
        
        try:
            leave_id = self.created_leave_ids[0]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/{leave_id}",
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}, Leave ID: {leave_id}"
            self.log_test("Leave Detail IDOR - Owner access", passed, details)
        except Exception as e:
            self.log_test("Leave Detail IDOR - Owner access", False, str(e))

    def test_leave_detail_idor_cross_user(self):
        """Test 2c: Different non-HR user (executive) GET that leave => 403"""
        print(f"\n{BLUE}📋 Test 2c: GET /api/hr/leaves/{{leave_id}} - Cross-user IDOR attempt{RESET}")
        if not self.created_leave_ids:
            self.log_test("Leave Detail IDOR - Cross-user blocked", False, "No leave created")
            return
        
        try:
            leave_id = self.created_leave_ids[0]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/{leave_id}",
                headers=self.get_headers(EXECUTIVE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 403
            data = response.json() if response.status_code in [403, 400] else {}
            error_code = ""
            if not data.get("success", True):
                errors = data.get("errors", [])
                if errors:
                    error_code = errors[0].get("code", "")
            
            details = f"Status: {response.status_code}, Code: {error_code}, Leave ID: {leave_id}"
            if passed and error_code == "LEAVE_OWNERSHIP_REQUIRED":
                details += " ✓ Correct error code"
            
            self.log_test("Leave Detail IDOR - Cross-user blocked", passed, details)
        except Exception as e:
            self.log_test("Leave Detail IDOR - Cross-user blocked", False, str(e))

    def test_leave_detail_idor_super_admin(self):
        """Test 2d: SUPER_ADMIN GET => 200"""
        print(f"\n{BLUE}📋 Test 2d: GET /api/hr/leaves/{{leave_id}} - SUPER_ADMIN access{RESET}")
        if not self.created_leave_ids:
            self.log_test("Leave Detail IDOR - SUPER_ADMIN access", False, "No leave created")
            return
        
        try:
            leave_id = self.created_leave_ids[0]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/{leave_id}",
                headers=self.get_headers(ADMIN_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}, Leave ID: {leave_id}"
            self.log_test("Leave Detail IDOR - SUPER_ADMIN access", passed, details)
        except Exception as e:
            self.log_test("Leave Detail IDOR - SUPER_ADMIN access", False, str(e))

    def test_leave_detail_idor_not_found(self):
        """Test 2e: GET non-existent leave_id => 404"""
        print(f"\n{BLUE}📋 Test 2e: GET /api/hr/leaves/{{leave_id}} - Non-existent leave{RESET}")
        try:
            fake_id = "00000000-0000-0000-0000-000000000000"
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/{fake_id}",
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 404
            details = f"Status: {response.status_code}, Leave ID: {fake_id}"
            self.log_test("Leave Detail IDOR - Not found", passed, details)
        except Exception as e:
            self.log_test("Leave Detail IDOR - Not found", False, str(e))

    def test_regression_leave_lifecycle(self):
        """Test 3: Core leave lifecycle still works for owner"""
        print(f"\n{BLUE}📋 Test 3: REGRESSION - Core leave lifecycle{RESET}")
        
        # 3a: GET /api/hr/leaves/types
        try:
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves/types",
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            self.log_test("Regression - GET leave types", passed, details)
        except Exception as e:
            self.log_test("Regression - GET leave types", False, str(e))
        
        # 3b: GET /api/hr/leaves (list own leaves)
        try:
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves",
                headers=self.get_headers(FINANCE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json()
                items = data.get("data", {}).get("items", [])
                details += f", Items: {len(items)}"
            self.log_test("Regression - GET own leaves list", passed, details)
        except Exception as e:
            self.log_test("Regression - GET own leaves list", False, str(e))
        
        # 3c: POST /api/hr/leaves/{id}/submit (if we have a draft)
        if self.created_leave_ids:
            try:
                leave_id = self.created_leave_ids[0]
                response = requests.post(
                    f"{BASE_URL}/api/hr/leaves/{leave_id}/submit",
                    headers=self.get_headers(FINANCE_EMAIL),
                    timeout=10
                )
                passed = response.status_code == 200
                details = f"Status: {response.status_code}, Leave ID: {leave_id}"
                self.log_test("Regression - Submit leave", passed, details)
            except Exception as e:
                self.log_test("Regression - Submit leave", False, str(e))
            
            # 3d: POST /api/hr/leaves/{id}/cancel
            try:
                leave_id = self.created_leave_ids[0]
                response = requests.post(
                    f"{BASE_URL}/api/hr/leaves/{leave_id}/cancel",
                    headers=self.get_headers(FINANCE_EMAIL),
                    timeout=10
                )
                passed = response.status_code == 200
                details = f"Status: {response.status_code}, Leave ID: {leave_id}"
                self.log_test("Regression - Cancel leave", passed, details)
            except Exception as e:
                self.log_test("Regression - Cancel leave", False, str(e))

    def test_regression_list_scoping(self):
        """Test 4: Non-HR user calling GET /api/hr/leaves?employee_id={someoneElseId} should only see own"""
        print(f"\n{BLUE}📋 Test 4: REGRESSION - List endpoint scoping{RESET}")
        try:
            # Executive trying to list Finance's leaves
            finance_id = self.user_ids[FINANCE_EMAIL]
            response = requests.get(
                f"{BASE_URL}/api/hr/leaves?employee_id={finance_id}",
                headers=self.get_headers(EXECUTIVE_EMAIL),
                timeout=10
            )
            passed = response.status_code == 200
            if passed:
                data = response.json()
                items = data.get("data", {}).get("items", [])
                # Check that all items belong to executive, not finance
                executive_id = self.user_ids[EXECUTIVE_EMAIL]
                all_own = all(item.get("employee_id") == executive_id for item in items)
                passed = all_own
                details = f"Status: {response.status_code}, Items: {len(items)}, All own: {all_own}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("Regression - List scoping (non-HR)", passed, details)
        except Exception as e:
            self.log_test("Regression - List scoping (non-HR)", False, str(e))

    def test_negative_quota_enforcement(self):
        """Test 5: Creating over-quota annual leave without allow_over_quota => 422/400"""
        print(f"\n{BLUE}📋 Test 5: NEGATIVE - Quota enforcement{RESET}")
        try:
            payload = {
                "leave_type": "annual",
                "start_date": "2026-09-01",
                "end_date": "2026-09-15",  # 15 days > 12 quota
                "days_count": 15,
                "notes": "Over-quota test"
            }
            response = requests.post(
                f"{BASE_URL}/api/hr/leaves",
                json=payload,
                headers=self.get_headers(EXECUTIVE_EMAIL),
                timeout=10
            )
            # Should fail with 400 or 422
            passed = response.status_code in [400, 422]
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json()
                if not data.get("success", True):
                    errors = data.get("errors", [])
                    if errors:
                        details += f", Error: {errors[0].get('message', '')[:100]}"
            
            self.log_test("Negative - Quota enforcement", passed, details)
        except Exception as e:
            self.log_test("Negative - Quota enforcement", False, str(e))

    def cleanup_leaves(self):
        """Cleanup: DELETE created leaves"""
        print(f"\n{BLUE}🧹 Cleanup: Deleting created leaves{RESET}")
        for leave_id in self.created_leave_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/hr/leaves/{leave_id}",
                    headers=self.get_headers(FINANCE_EMAIL),
                    timeout=10
                )
                if response.status_code == 200:
                    print(f"{GREEN}✅ Deleted leave {leave_id}{RESET}")
                else:
                    print(f"{YELLOW}⚠️ Could not delete leave {leave_id}: {response.status_code}{RESET}")
            except Exception as e:
                print(f"{YELLOW}⚠️ Error deleting leave {leave_id}: {str(e)}{RESET}")

    def print_summary(self):
        """Print test summary."""
        print(f"\n{'='*70}")
        print(f"{BLUE}📊 IDOR SECURITY TEST SUMMARY{RESET}")
        print(f"{'='*70}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.errors:
            print(f"\n{RED}{'='*70}")
            print(f"FAILED TESTS DETAIL:")
            print(f"{'='*70}{RESET}")
            for i, error in enumerate(self.errors, 1):
                print(f"\n{RED}{i}. {error['test']}{RESET}")
                print(f"   {error['details']}")
        
        print(f"\n{'='*70}")
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*70}")
    print(f"🔒 IDOR SECURITY FIX VALIDATION - Leave Endpoints")
    print(f"{'='*70}{RESET}")
    print(f"Base URL: {BASE_URL}")
    print(f"Testing P0 security fix: LEAVE_OWNERSHIP_REQUIRED guard")
    
    tester = IDORSecurityTester()
    
    # Login all test users (with rate limit consideration)
    print(f"\n{BLUE}{'='*70}")
    print(f"PHASE 1: Authentication")
    print(f"{'='*70}{RESET}")
    
    admin_auth = tester.login(ADMIN_EMAIL)
    time.sleep(1)  # Rate limit consideration
    finance_auth = tester.login(FINANCE_EMAIL)
    time.sleep(1)
    executive_auth = tester.login(EXECUTIVE_EMAIL)
    
    if not all([admin_auth, finance_auth, executive_auth]):
        print(f"\n{RED}❌ CRITICAL: Could not login all test users. Aborting.{RESET}")
        return 1
    
    # Run IDOR tests
    print(f"\n{BLUE}{'='*70}")
    print(f"PHASE 2: IDOR Fix - Summary Endpoint")
    print(f"{'='*70}{RESET}")
    tester.test_summary_idor_owner()
    tester.test_summary_idor_cross_user()
    tester.test_summary_idor_super_admin()
    tester.test_summary_idor_no_auth()
    
    print(f"\n{BLUE}{'='*70}")
    print(f"PHASE 3: IDOR Fix - Leave Detail Endpoint")
    print(f"{'='*70}{RESET}")
    tester.test_leave_detail_idor_create()
    time.sleep(0.5)
    tester.test_leave_detail_idor_owner()
    tester.test_leave_detail_idor_cross_user()
    tester.test_leave_detail_idor_super_admin()
    tester.test_leave_detail_idor_not_found()
    
    print(f"\n{BLUE}{'='*70}")
    print(f"PHASE 4: Regression Tests")
    print(f"{'='*70}{RESET}")
    tester.test_regression_leave_lifecycle()
    tester.test_regression_list_scoping()
    
    print(f"\n{BLUE}{'='*70}")
    print(f"PHASE 5: Negative Tests")
    print(f"{'='*70}{RESET}")
    tester.test_negative_quota_enforcement()
    
    # Cleanup
    tester.cleanup_leaves()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
