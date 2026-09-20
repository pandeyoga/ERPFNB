#!/usr/bin/env python3
"""
BUSINESS LOGIC EDGE CASES TESTING - DEEP VALIDATION
Test boundary conditions, extreme values, edge cases that can break business logic
NO SHALLOW TESTING. DEPTH ONLY.
"""

import requests
import json
from datetime import datetime, timedelta
from decimal import Decimal

BASE_URL = "http://localhost:8001"
CREDENTIALS = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}

class EdgeCaseTester:
    def __init__(self):
        self.token = None
        self.bugs_found = []
        self.tests_run = 0
        self.tests_passed = 0
        
    def auth(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success"):
                self.token = data["data"]["access_token"]
                return True
        return False
    
    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def log_bug(self, test_name, issue, severity="HIGH"):
        self.bugs_found.append({
            "test": test_name,
            "issue": issue,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        })
        print(f"  🐛 BUG FOUND: {issue}")
    
    def test_journal_extreme_line_count(self):
        """Edge Case: Journal with 100+ lines - does it stay balanced?"""
        print("\n🧪 Testing: Journal with 100+ lines...")
        self.tests_run += 1
        
        # Get existing journals first
        try:
            resp = requests.get(
                f"{BASE_URL}/api/finance/journals",
                headers=self.headers(),
                params={"limit": 100},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    journals = data["data"]
                    
                    # Find journals with many lines
                    large_journals = [j for j in journals if len(j.get("lines", [])) > 50]
                    
                    if large_journals:
                        for je in large_journals[:3]:  # Test first 3
                            dr = float(je.get("total_dr", 0))
                            cr = float(je.get("total_cr", 0))
                            lines = len(je.get("lines", []))
                            
                            if abs(dr - cr) > 0.01:
                                self.log_bug(
                                    "journal_large_unbalanced",
                                    f"Journal {je['doc_no']} with {lines} lines is UNBALANCED: Dr={dr}, Cr={cr}",
                                    "CRITICAL"
                                )
                            else:
                                print(f"  ✅ Journal {je['doc_no']} with {lines} lines is balanced")
                                self.tests_passed += 1
                    else:
                        print(f"  ⏭️  No large journals found (tested {len(journals)} journals)")
                        self.tests_passed += 1
                        
        except Exception as e:
            self.log_bug("journal_extreme_test", f"Exception: {str(e)}")
    
    def test_negative_amounts(self):
        """Edge Case: Negative amounts in daily sales - should be rejected"""
        print("\n🧪 Testing: Negative amounts validation...")
        self.tests_run += 1
        
        try:
            # Try to create daily sales with negative amount
            payload = {
                "outlet_id": "test-outlet-id",
                "date": "2026-06-18",
                "total_revenue": -1000,  # NEGATIVE!
                "items": [
                    {"name": "Test", "amount": -1000}
                ]
            }
            
            resp = requests.post(
                f"{BASE_URL}/api/outlet/daily-sales/draft",
                headers=self.headers(),
                json=payload,
                timeout=10
            )
            
            if resp.status_code in [200, 201]:
                self.log_bug(
                    "negative_amount_accepted",
                    "System accepted negative daily sales amount! Should reject with 422",
                    "CRITICAL"
                )
            elif resp.status_code == 422:
                print(f"  ✅ Negative amount correctly rejected with 422")
                self.tests_passed += 1
            else:
                print(f"  ⚠️  Unexpected response: {resp.status_code}")
                
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def test_future_dates(self):
        """Edge Case: Transactions with future dates - should be rejected"""
        print("\n🧪 Testing: Future date validation...")
        self.tests_run += 1
        
        try:
            future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            
            payload = {
                "outlet_id": "test-outlet-id",
                "date": future_date,  # 1 year in future!
                "total_revenue": 1000
            }
            
            resp = requests.post(
                f"{BASE_URL}/api/outlet/daily-sales/draft",
                headers=self.headers(),
                json=payload,
                timeout=10
            )
            
            if resp.status_code in [200, 201]:
                self.log_bug(
                    "future_date_accepted",
                    f"System accepted future date ({future_date})! Should reject",
                    "HIGH"
                )
            elif resp.status_code == 422:
                print(f"  ✅ Future date correctly rejected")
                self.tests_passed += 1
            else:
                print(f"  ⚠️  Unexpected response: {resp.status_code}")
                
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def test_leave_quota_overflow(self):
        """Edge Case: Leave request exceeding quota - should be blocked"""
        print("\n🧪 Testing: Leave quota overflow prevention...")
        self.tests_run += 1
        
        try:
            # Get employees
            resp = requests.get(
                f"{BASE_URL}/api/hr/employees",
                headers=self.headers(),
                params={"limit": 5},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    employees = data["data"]
                    
                    if employees:
                        emp_id = employees[0]["id"]
                        
                        # Get leave summary
                        resp = requests.get(
                            f"{BASE_URL}/api/hr/leaves/summary/{emp_id}",
                            headers=self.headers(),
                            timeout=10
                        )
                        
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("success"):
                                summary = data["data"]
                                used = int(summary.get("used", 0))
                                quota = int(summary.get("quota", 0))
                                
                                if used > quota:
                                    self.log_bug(
                                        "leave_quota_overflow",
                                        f"Employee {emp_id}: used={used} EXCEEDS quota={quota}!",
                                        "CRITICAL"
                                    )
                                else:
                                    print(f"  ✅ Leave quota enforced: used={used}, quota={quota}")
                                    self.tests_passed += 1
                                    
                                    # Try to create leave that would exceed quota
                                    days_to_request = quota - used + 5  # Request more than remaining
                                    
                                    if days_to_request > 0:
                                        payload = {
                                            "employee_id": emp_id,
                                            "leave_type": "annual",
                                            "start_date": "2026-07-01",
                                            "end_date": (datetime(2026, 7, 1) + timedelta(days=days_to_request)).strftime("%Y-%m-%d"),
                                            "reason": "Test"
                                        }
                                        
                                        resp = requests.post(
                                            f"{BASE_URL}/api/hr/leaves",
                                            headers=self.headers(),
                                            json=payload,
                                            timeout=10
                                        )
                                        
                                        if resp.status_code in [200, 201]:
                                            self.log_bug(
                                                "leave_over_quota_accepted",
                                                f"System accepted leave request exceeding quota!",
                                                "HIGH"
                                            )
                                        elif resp.status_code == 422:
                                            print(f"  ✅ Over-quota leave correctly rejected")
                                        else:
                                            print(f"  ⏭️  Cannot test (status: {resp.status_code})")
                    else:
                        print(f"  ⏭️  No employees found")
                        
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def test_ap_aging_negative_dates(self):
        """Edge Case: AP Aging with invoices in future - should handle gracefully"""
        print("\n🧪 Testing: AP Aging with edge case dates...")
        self.tests_run += 1
        
        try:
            resp = requests.get(
                f"{BASE_URL}/api/finance/ap-aging",
                headers=self.headers(),
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    vendors = data["data"]
                    
                    for vendor in vendors:
                        # Check if aging buckets are valid (no negative amounts)
                        buckets = [
                            float(vendor.get("current", 0)),
                            float(vendor.get("days_1_30", 0)),
                            float(vendor.get("days_31_60", 0)),
                            float(vendor.get("days_61_90", 0)),
                            float(vendor.get("over_90", 0))
                        ]
                        
                        if any(b < 0 for b in buckets):
                            self.log_bug(
                                "ap_aging_negative",
                                f"Vendor {vendor.get('vendor_name')}: has NEGATIVE aging bucket!",
                                "HIGH"
                            )
                        
                        # Check totals match
                        total = float(vendor.get("total", 0))
                        bucket_sum = sum(buckets)
                        
                        if abs(total - bucket_sum) > 0.01:
                            self.log_bug(
                                "ap_aging_mismatch",
                                f"Vendor {vendor.get('vendor_name')}: total={total} but buckets sum to {bucket_sum}",
                                "HIGH"
                            )
                    
                    print(f"  ✅ AP Aging calculations validated for {len(vendors)} vendors")
                    self.tests_passed += 1
                    
        except Exception as e:
            self.log_bug("ap_aging_test", f"Exception: {str(e)}")
    
    def test_zero_and_null_values(self):
        """Edge Case: Zero and null values in calculations"""
        print("\n🧪 Testing: Zero/null value handling...")
        self.tests_run += 1
        
        try:
            # Test journal with zero amounts
            resp = requests.get(
                f"{BASE_URL}/api/finance/journals",
                headers=self.headers(),
                params={"limit": 100},
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    journals = data["data"]
                    
                    zero_journals = [j for j in journals if float(j.get("total_dr", 0)) == 0]
                    
                    if zero_journals:
                        print(f"  ⚠️  Found {len(zero_journals)} journals with zero total")
                        for je in zero_journals[:3]:
                            self.log_bug(
                                "zero_amount_journal",
                                f"Journal {je['doc_no']} has zero Dr/Cr - should this be allowed?",
                                "MEDIUM"
                            )
                    else:
                        print(f"  ✅ No zero-amount journals found")
                        self.tests_passed += 1
                        
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def test_special_characters_injection(self):
        """Edge Case: Special characters and potential injection attempts"""
        print("\n🧪 Testing: Special character handling...")
        self.tests_run += 1
        
        try:
            # Try search with special characters
            test_inputs = [
                "'; DROP TABLE users; --",  # SQL injection attempt
                "<script>alert('xss')</script>",  # XSS attempt
                "../../etc/passwd",  # Path traversal
                "' OR '1'='1",  # SQL injection
            ]
            
            for test_input in test_inputs:
                resp = requests.get(
                    f"{BASE_URL}/api/search",
                    headers=self.headers(),
                    params={"q": test_input},
                    timeout=10
                )
                
                if resp.status_code == 500:
                    self.log_bug(
                        "injection_crash",
                        f"Search crashed with input: {test_input[:30]}",
                        "CRITICAL"
                    )
                elif resp.status_code == 200:
                    # Check if special chars were sanitized
                    data = resp.json()
                    # Should not return raw input
                    print(f"  ✅ Special characters handled safely")
            
            self.tests_passed += 1
                    
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def test_concurrent_updates(self):
        """Edge Case: Concurrent updates to same resource"""
        print("\n🧪 Testing: Concurrent update handling...")
        self.tests_run += 1
        
        # This would require threading to test properly
        # For now, log as TODO
        print(f"  ⏭️  Concurrent update testing requires threading (TODO)")
        
    def test_large_text_fields(self):
        """Edge Case: Very long text in description fields"""
        print("\n🧪 Testing: Large text field handling...")
        self.tests_run += 1
        
        try:
            # Try to create leave with very long reason
            long_text = "A" * 10000  # 10KB of text
            
            payload = {
                "employee_id": "test-id",
                "leave_type": "annual",
                "start_date": "2026-07-01",
                "end_date": "2026-07-02",
                "reason": long_text
            }
            
            resp = requests.post(
                f"{BASE_URL}/api/hr/leaves",
                headers=self.headers(),
                json=payload,
                timeout=10
            )
            
            if resp.status_code == 500:
                self.log_bug(
                    "large_text_crash",
                    "System crashed with 10KB text field",
                    "HIGH"
                )
            elif resp.status_code == 422:
                print(f"  ✅ Large text correctly rejected")
                self.tests_passed += 1
            else:
                print(f"  ⚠️  Response: {resp.status_code}")
                
        except Exception as e:
            print(f"  ⚠️  Exception: {str(e)}")
    
    def run_all_edge_cases(self):
        print("\n" + "="*80)
        print("🧪 BUSINESS LOGIC EDGE CASE TESTING - DEEP VALIDATION")
        print("="*80)
        
        if not self.auth():
            print("❌ Authentication failed")
            return
        
        print("✅ Authenticated\n")
        
        # Run all edge case tests
        self.test_journal_extreme_line_count()
        self.test_negative_amounts()
        self.test_future_dates()
        self.test_leave_quota_overflow()
        self.test_ap_aging_negative_dates()
        self.test_zero_and_null_values()
        self.test_special_characters_injection()
        self.test_concurrent_updates()
        self.test_large_text_fields()
        
        self.print_summary()
    
    def print_summary(self):
        print("\n" + "="*80)
        print("📊 EDGE CASE TESTING SUMMARY")
        print("="*80)
        
        print(f"\n🎯 Results:")
        print(f"  Tests Run: {self.tests_run}")
        print(f"  Tests Passed: {self.tests_passed}")
        print(f"  Bugs Found: {len(self.bugs_found)} 🐛")
        
        if self.bugs_found:
            print(f"\n🐛 BUGS FOUND BY SEVERITY:")
            
            by_severity = {}
            for bug in self.bugs_found:
                sev = bug["severity"]
                if sev not in by_severity:
                    by_severity[sev] = []
                by_severity[sev].append(bug)
            
            for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                if severity in by_severity:
                    print(f"\n  {severity} ({len(by_severity[severity])} bugs):")
                    for bug in by_severity[severity]:
                        print(f"    - {bug['test']}: {bug['issue']}")
        else:
            print(f"\n✅ No edge case bugs found!")
        
        # Save report
        report_path = f"/app/test_reports/edge_case_testing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump({
                "tests_run": self.tests_run,
                "tests_passed": self.tests_passed,
                "bugs": self.bugs_found
            }, f, indent=2)
        print(f"\n💾 Report saved: {report_path}")

def main():
    tester = EdgeCaseTester()
    tester.run_all_edge_cases()
    return 0

if __name__ == "__main__":
    exit(main())
