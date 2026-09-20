"""
Phase 5C: Anomaly Feed Backend API Test
Tests all anomaly endpoints including new Phase 5C features
"""
import requests
import sys
from datetime import datetime, timedelta

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class AnomalyAPITester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []

    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"{GREEN}✅ PASS{RESET} - {name}")
            if details:
                print(f"   {BLUE}{details}{RESET}")
        else:
            self.tests_failed += 1
            self.errors.append({"test": name, "details": details})
            print(f"{RED}❌ FAIL{RESET} - {name}")
            if details:
                print(f"   {RED}{details}{RESET}")

    def login(self, email="admin@fnbgroup.id", password="Demo@2026"):
        """Login and get token"""
        print(f"\n{BLUE}🔐 Logging in as {email}...{RESET}")
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("data", {}).get("access_token")
                if self.token:
                    print(f"{GREEN}✅ Login successful{RESET}")
                    return True
                else:
                    print(f"{RED}❌ No token in response{RESET}")
                    return False
            else:
                print(f"{RED}❌ Login failed: {response.status_code} - {response.text[:200]}{RESET}")
                return False
        except Exception as e:
            print(f"{RED}❌ Login error: {str(e)}{RESET}")
            return False

    def get_headers(self):
        """Get request headers with auth token"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_list_anomalies(self):
        """Test GET /api/anomalies - basic list"""
        print(f"\n{BLUE}📋 Testing: List Anomalies (basic){RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies",
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json().get("data", [])
                details += f", Count: {len(data)}"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("List Anomalies (basic)", passed, details)
            return passed
        except Exception as e:
            self.log_test("List Anomalies (basic)", False, str(e))
            return False

    def test_list_with_pagination(self):
        """Test GET /api/anomalies with page & per_page params"""
        print(f"\n{BLUE}📄 Testing: List Anomalies with Pagination{RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies",
                params={"page": 1, "per_page": 10},
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                json_data = response.json()
                data = json_data.get("data", [])
                meta = json_data.get("meta", {})
                details += f", Items: {len(data)}, Page: {meta.get('page')}, Total: {meta.get('total')}"
                # Verify pagination metadata
                if "page" not in meta or "per_page" not in meta or "total" not in meta:
                    passed = False
                    details += " - Missing pagination metadata"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("List with Pagination", passed, details)
            return passed
        except Exception as e:
            self.log_test("List with Pagination", False, str(e))
            return False

    def test_list_with_period_filter(self):
        """Test GET /api/anomalies with date_from & date_to (Phase 5C.1)"""
        print(f"\n{BLUE}📅 Testing: List Anomalies with Period Filter{RESET}")
        try:
            # Test with current month
            today = datetime.now()
            date_from = today.replace(day=1).strftime("%Y-%m-%d")
            next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
            date_to = next_month.strftime("%Y-%m-%d")
            
            response = requests.get(
                f"{self.base_url}/anomalies",
                params={"date_from": date_from, "date_to": date_to},
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}, Period: {date_from} to {date_to}"
            if passed:
                data = response.json().get("data", [])
                details += f", Count: {len(data)}"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("Period Filter", passed, details)
            return passed
        except Exception as e:
            self.log_test("Period Filter", False, str(e))
            return False

    def test_list_with_filters(self):
        """Test GET /api/anomalies with type, severity, status filters"""
        print(f"\n{BLUE}🔍 Testing: List Anomalies with Filters{RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies",
                params={"severity": "severe", "status": "open"},
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json().get("data", [])
                details += f", Filtered Count: {len(data)}"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("Filters (severity, status)", passed, details)
            return passed
        except Exception as e:
            self.log_test("Filters (severity, status)", False, str(e))
            return False

    def test_get_anomaly_types(self):
        """Test GET /api/anomalies/types"""
        print(f"\n{BLUE}📑 Testing: Get Anomaly Types{RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies/types",
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json().get("data", [])
                details += f", Types Count: {len(data)}"
                # Verify structure
                if data and isinstance(data[0], dict):
                    if "value" in data[0] and "label" in data[0]:
                        details += f", Sample: {data[0]}"
                    else:
                        passed = False
                        details += " - Invalid structure (missing value/label)"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("Get Anomaly Types", passed, details)
            return passed
        except Exception as e:
            self.log_test("Get Anomaly Types", False, str(e))
            return False

    def test_get_summary(self):
        """Test GET /api/anomalies/summary (Phase 5C.6)"""
        print(f"\n{BLUE}📊 Testing: Get Anomaly Summary{RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies/summary",
                params={"days": 30},
                headers=self.get_headers(),
                timeout=10
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                data = response.json().get("data", {})
                counts = data.get("counts", {})
                by_type = data.get("by_type", [])
                by_outlet = data.get("by_outlet", [])
                details += f", Total: {counts.get('total')}, Severe: {counts.get('severe')}, Types: {len(by_type)}, Outlets: {len(by_outlet)}"
                # Verify structure
                required_keys = ["counts", "by_type", "by_outlet"]
                missing = [k for k in required_keys if k not in data]
                if missing:
                    passed = False
                    details += f" - Missing keys: {missing}"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("Get Summary (Analytics)", passed, details)
            return passed
        except Exception as e:
            self.log_test("Get Summary (Analytics)", False, str(e))
            return False

    def test_export_csv(self):
        """Test GET /api/anomalies/export/csv (Phase 5C.3)"""
        print(f"\n{BLUE}📥 Testing: Export CSV{RESET}")
        try:
            response = requests.get(
                f"{self.base_url}/anomalies/export/csv",
                params={"status": "open"},
                headers=self.get_headers(),
                timeout=15
            )
            passed = response.status_code == 200
            details = f"Status: {response.status_code}"
            if passed:
                # Check if response is CSV
                content_type = response.headers.get("Content-Type", "")
                if "csv" in content_type.lower() or "text/csv" in content_type.lower():
                    details += f", Content-Type: {content_type}, Size: {len(response.content)} bytes"
                    # Check for CSV headers
                    content = response.text
                    if "ID" in content and "Type" in content:
                        details += " - Valid CSV structure"
                    else:
                        passed = False
                        details += " - Invalid CSV (missing expected headers)"
                else:
                    # Might be JSON response if no data
                    try:
                        json_data = response.json()
                        if "message" in json_data.get("data", {}):
                            details += f" - {json_data['data']['message']}"
                        else:
                            passed = False
                            details += f" - Unexpected response format"
                    except Exception:
                        passed = False
                        details += f" - Invalid Content-Type: {content_type}"
            else:
                details += f", Error: {response.text[:200]}"
            self.log_test("Export CSV", passed, details)
            return passed
        except Exception as e:
            self.log_test("Export CSV", False, str(e))
            return False

    def test_triage_flow(self):
        """Test POST /api/anomalies/{id}/triage with assigned_to (Phase 5C.3)"""
        print(f"\n{BLUE}🔧 Testing: Triage Anomaly (with assignment){RESET}")
        try:
            # First, get an anomaly to triage
            list_response = requests.get(
                f"{self.base_url}/anomalies",
                params={"status": "open", "per_page": 1},
                headers=self.get_headers(),
                timeout=10
            )
            
            if list_response.status_code != 200:
                self.log_test("Triage Flow", False, "Failed to fetch anomaly for triage")
                return False
            
            anomalies = list_response.json().get("data", [])
            if not anomalies:
                self.log_test("Triage Flow", True, "No open anomalies to test (SKIP)")
                return True
            
            anomaly_id = anomalies[0].get("id")
            
            # Test triage with assignment
            triage_response = requests.post(
                f"{self.base_url}/anomalies/{anomaly_id}/triage",
                json={
                    "status": "acknowledged",
                    "note": "Test triage from automated test",
                    "assigned_to": "test-user-id"  # Phase 5C.3
                },
                headers=self.get_headers(),
                timeout=10
            )
            
            passed = triage_response.status_code == 200
            details = f"Status: {triage_response.status_code}"
            if passed:
                data = triage_response.json().get("data", {})
                details += f", New Status: {data.get('status')}, Assigned: {data.get('assigned_to')}"
                # Verify assigned_to was set
                if data.get("assigned_to") != "test-user-id":
                    passed = False
                    details += " - assigned_to not set correctly"
            else:
                details += f", Error: {triage_response.text[:200]}"
            
            self.log_test("Triage with Assignment", passed, details)
            return passed
        except Exception as e:
            self.log_test("Triage with Assignment", False, str(e))
            return False

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*70}")
        print(f"{BLUE}📊 TEST SUMMARY - Phase 5C Anomaly Feed{RESET}")
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
        
        print(f"\n{'='*70}\n")
        return self.tests_failed == 0


def main():
    print(f"{BLUE}{'='*70}")
    print(f"Phase 5C: Anomaly Feed Backend API Test")
    print(f"{'='*70}{RESET}\n")
    
    tester = AnomalyAPITester()
    
    # Login first
    if not tester.login():
        print(f"\n{RED}❌ Cannot proceed without authentication{RESET}")
        return 1
    
    # Run all tests
    tester.test_list_anomalies()
    tester.test_list_with_pagination()
    tester.test_list_with_period_filter()
    tester.test_list_with_filters()
    tester.test_get_anomaly_types()
    tester.test_get_summary()
    tester.test_export_csv()
    tester.test_triage_flow()
    
    # Print summary
    success = tester.print_summary()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
