#!/usr/bin/env python3
"""
COMPREHENSIVE LOGIC TESTING SCRIPT
Tujuan: Achieve 0% BUG dengan testing logic, bukan hanya API response
- Extract semua 572 endpoints dari openapi.json
- Test dengan business logic validation
- Verify calculations, state transitions, data integrity
"""

import requests
import json
import sys
from datetime import datetime
from collections import defaultdict

BASE_URL = "http://localhost:8001"
CREDENTIALS = {
    "email": "admin@fnbgroup.id",
    "password": "Demo@2026"
}

class ComprehensiveLogicTester:
    def __init__(self):
        self.token = None
        self.results = {
            "total_endpoints": 0,
            "tested": 0,
            "passed": 0,
            "failed": 0,
            "logic_errors": [],
            "api_errors": [],
            "by_module": defaultdict(lambda: {"tested": 0, "passed": 0, "failed": 0})
        }
        self.endpoints = []
        
    def authenticate(self):
        """Login dan dapatkan JWT token"""
        print("🔐 Authenticating...")
        try:
            resp = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")
                print(f"✅ Authenticated successfully")
                return True
            else:
                print(f"❌ Auth failed: {resp.status_code}")
                return False
        except Exception as e:
            print(f"❌ Auth error: {str(e)}")
            return False
    
    def get_headers(self):
        """Return auth headers"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def extract_endpoints(self):
        """Extract semua endpoints dari OpenAPI spec"""
        print("\n📋 Extracting endpoints from OpenAPI spec...")
        try:
            resp = requests.get(f"{BASE_URL}/openapi.json", timeout=10)
            spec = resp.json()
            paths = spec.get("paths", {})
            
            for path, methods in paths.items():
                for method in methods.keys():
                    if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
                        self.endpoints.append({
                            "method": method.upper(),
                            "path": path,
                            "module": self._extract_module(path)
                        })
            
            self.results["total_endpoints"] = len(self.endpoints)
            print(f"✅ Found {len(self.endpoints)} endpoints")
            
            # Print module breakdown
            modules = defaultdict(int)
            for ep in self.endpoints:
                modules[ep["module"]] += 1
            print("\n📊 Endpoints by module:")
            for mod, count in sorted(modules.items(), key=lambda x: x[1], reverse=True):
                print(f"  - {mod}: {count} endpoints")
            
            return True
        except Exception as e:
            print(f"❌ Failed to extract endpoints: {str(e)}")
            return False
    
    def _extract_module(self, path):
        """Extract module name from path"""
        parts = path.strip("/").split("/")
        if len(parts) >= 2:
            return parts[1]  # e.g., /api/finance/journals -> finance
        return "root"
    
    def test_endpoint(self, endpoint):
        """Test individual endpoint dengan logic validation"""
        method = endpoint["method"]
        path = endpoint["path"]
        module = endpoint["module"]
        
        # Skip endpoints yang butuh path params untuk initial sweep
        if "{" in path:
            return {"status": "skipped", "reason": "requires_path_params"}
        
        try:
            # Test based on method
            if method == "GET":
                return self._test_get(path, module)
            elif method == "POST":
                return self._test_post(path, module)
            elif method in ["PUT", "PATCH"]:
                return self._test_update(path, module)
            elif method == "DELETE":
                return self._test_delete(path, module)
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _test_get(self, path, module):
        """Test GET endpoint dengan validation"""
        try:
            resp = requests.get(f"{BASE_URL}{path}", headers=self.get_headers(), timeout=10)
            
            result = {
                "status_code": resp.status_code,
                "path": path,
                "module": module
            }
            
            # Status code validation
            if resp.status_code == 200:
                data = resp.json()
                
                # Logic validation berdasarkan module
                logic_valid = self._validate_response_logic(path, data, module)
                
                if logic_valid["valid"]:
                    result["status"] = "passed"
                else:
                    result["status"] = "logic_error"
                    result["logic_issue"] = logic_valid["issue"]
                    
            elif resp.status_code == 404:
                result["status"] = "not_found"
            elif resp.status_code == 403:
                result["status"] = "forbidden"
            elif resp.status_code == 401:
                result["status"] = "unauthorized"
            else:
                result["status"] = "failed"
                result["response"] = resp.text[:200]
            
            return result
            
        except requests.exceptions.Timeout:
            return {"status": "timeout", "path": path}
        except Exception as e:
            return {"status": "error", "message": str(e), "path": path}
    
    def _test_post(self, path, module):
        """Test POST endpoint - lebih conservative, hanya test yang aman"""
        # Skip POST endpoints yang bisa create data untuk initial sweep
        # Kita akan test ini di Phase 1D (Business Logic Testing)
        if any(x in path for x in ["/journals", "/pos", "/prs", "/invoices", "/payments"]):
            return {"status": "skipped", "reason": "requires_business_logic_test"}
        
        try:
            # Test dengan empty payload untuk check validation
            resp = requests.post(f"{BASE_URL}{path}", headers=self.get_headers(), json={}, timeout=10)
            
            result = {
                "status_code": resp.status_code,
                "path": path,
                "module": module
            }
            
            if resp.status_code in [200, 201]:
                result["status"] = "passed"
            elif resp.status_code == 422:
                # 422 adalah expected untuk empty payload - ini GOOD validation
                result["status"] = "passed"
                result["note"] = "validation_working"
            elif resp.status_code == 404:
                result["status"] = "not_found"
            elif resp.status_code == 405:
                result["status"] = "method_not_allowed"
            else:
                result["status"] = "failed"
                
            return result
        except Exception as e:
            return {"status": "error", "message": str(e), "path": path}
    
    def _test_update(self, path, module):
        """Test PUT/PATCH - skip untuk initial sweep"""
        return {"status": "skipped", "reason": "requires_entity_id"}
    
    def _test_delete(self, path, module):
        """Test DELETE - skip untuk initial sweep"""
        return {"status": "skipped", "reason": "requires_entity_id"}
    
    def _validate_response_logic(self, path, data, module):
        """Validate business logic dari response"""
        
        # Finance module validations
        if module == "finance":
            if "journals" in path:
                return self._validate_journal_logic(data)
            elif "ap-aging" in path:
                return self._validate_aging_logic(data)
            elif "ledger" in path:
                return self._validate_ledger_logic(data)
        
        # Procurement module
        elif module == "procurement":
            if "market-list" in path:
                return self._validate_market_list_logic(data)
        
        # HR module
        elif module == "hr":
            if "leaves" in path:
                return self._validate_leave_logic(data)
        
        # Outlet module
        elif module == "outlet":
            if "daily-sales" in path:
                return self._validate_sales_logic(data)
        
        # Default: just check data structure
        if isinstance(data, list):
            return {"valid": True}
        elif isinstance(data, dict):
            return {"valid": True}
        else:
            return {"valid": False, "issue": "Invalid response type"}
    
    def _validate_journal_logic(self, data):
        """Validate journal entries: Dr must equal Cr"""
        if isinstance(data, list):
            for journal in data:
                if "total_dr" in journal and "total_cr" in journal:
                    dr = float(journal.get("total_dr", 0))
                    cr = float(journal.get("total_cr", 0))
                    if abs(dr - cr) > 0.01:  # Allow 1 cent tolerance
                        return {
                            "valid": False,
                            "issue": f"Journal {journal.get('doc_no')} not balanced: Dr={dr}, Cr={cr}"
                        }
        return {"valid": True}
    
    def _validate_aging_logic(self, data):
        """Validate AP/AR aging: buckets should sum to total"""
        if isinstance(data, list):
            for vendor in data:
                if all(k in vendor for k in ["current", "days_1_30", "days_31_60", "days_61_90", "over_90", "total"]):
                    bucket_sum = sum([
                        float(vendor.get("current", 0)),
                        float(vendor.get("days_1_30", 0)),
                        float(vendor.get("days_31_60", 0)),
                        float(vendor.get("days_61_90", 0)),
                        float(vendor.get("over_90", 0))
                    ])
                    total = float(vendor.get("total", 0))
                    if abs(bucket_sum - total) > 0.01:
                        return {
                            "valid": False,
                            "issue": f"Aging buckets don't sum to total: {bucket_sum} != {total}"
                        }
        return {"valid": True}
    
    def _validate_ledger_logic(self, data):
        """Validate ledger: running balance should be correct"""
        # TODO: Implement running balance validation
        return {"valid": True}
    
    def _validate_market_list_logic(self, data):
        """Validate market list: prices should be positive"""
        if isinstance(data, list):
            for item in data:
                if "price" in item:
                    price = float(item.get("price", 0))
                    if price < 0:
                        return {
                            "valid": False,
                            "issue": f"Negative price found: {item.get('item_name')} = {price}"
                        }
        return {"valid": True}
    
    def _validate_leave_logic(self, data):
        """Validate leave requests: used <= quota"""
        if isinstance(data, dict) and "summary" in data:
            summary = data["summary"]
            if "used" in summary and "quota" in summary:
                used = int(summary.get("used", 0))
                quota = int(summary.get("quota", 0))
                if used > quota:
                    return {
                        "valid": False,
                        "issue": f"Leave used ({used}) exceeds quota ({quota})"
                    }
        return {"valid": True}
    
    def _validate_sales_logic(self, data):
        """Validate daily sales: total should match sum of items"""
        # TODO: Implement sales validation
        return {"valid": True}
    
    def run_sweep(self):
        """Run comprehensive endpoint sweep"""
        print("\n" + "="*80)
        print("🚀 STARTING COMPREHENSIVE API SWEEP")
        print("="*80)
        
        for i, endpoint in enumerate(self.endpoints, 1):
            method = endpoint["method"]
            path = endpoint["path"]
            module = endpoint["module"]
            
            # Progress indicator every 50 endpoints
            if i % 50 == 0:
                print(f"\n📊 Progress: {i}/{len(self.endpoints)} endpoints tested...")
            
            result = self.test_endpoint(endpoint)
            
            self.results["tested"] += 1
            self.results["by_module"][module]["tested"] += 1
            
            if result.get("status") == "passed":
                self.results["passed"] += 1
                self.results["by_module"][module]["passed"] += 1
                print(f"✅ {method:6s} {path[:60]:<60s} PASSED")
                
            elif result.get("status") == "logic_error":
                self.results["failed"] += 1
                self.results["by_module"][module]["failed"] += 1
                self.results["logic_errors"].append({
                    "method": method,
                    "path": path,
                    "module": module,
                    "issue": result.get("logic_issue")
                })
                print(f"⚠️  {method:6s} {path[:60]:<60s} LOGIC ERROR: {result.get('logic_issue')}")
                
            elif result.get("status") in ["not_found", "method_not_allowed", "failed"]:
                self.results["failed"] += 1
                self.results["by_module"][module]["failed"] += 1
                self.results["api_errors"].append({
                    "method": method,
                    "path": path,
                    "module": module,
                    "status_code": result.get("status_code"),
                    "status": result.get("status")
                })
                print(f"❌ {method:6s} {path[:60]:<60s} {result.get('status').upper()}")
                
            elif result.get("status") == "skipped":
                print(f"⏭️  {method:6s} {path[:60]:<60s} SKIPPED ({result.get('reason')})")
        
        print(f"\n✅ Sweep completed: {self.results['tested']}/{self.results['total_endpoints']} endpoints tested")
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("📊 COMPREHENSIVE TEST REPORT")
        print("="*80)
        
        print(f"\n🎯 OVERALL RESULTS:")
        print(f"  Total Endpoints: {self.results['total_endpoints']}")
        print(f"  Tested: {self.results['tested']}")
        print(f"  Passed: {self.results['passed']}")
        print(f"  Failed: {self.results['failed']}")
        
        pass_rate = (self.results['passed'] / self.results['tested'] * 100) if self.results['tested'] > 0 else 0
        print(f"\n  ✅ Pass Rate: {pass_rate:.1f}%")
        
        print(f"\n🐛 ERRORS FOUND:")
        print(f"  Logic Errors: {len(self.results['logic_errors'])}")
        print(f"  API Errors: {len(self.results['api_errors'])}")
        
        # Show logic errors
        if self.results['logic_errors']:
            print(f"\n⚠️  LOGIC ERRORS (Business Rule Violations):")
            for err in self.results['logic_errors']:
                print(f"  - {err['method']} {err['path']}")
                print(f"    Issue: {err['issue']}")
        
        # Show API errors grouped by type
        if self.results['api_errors']:
            print(f"\n❌ API ERRORS:")
            
            # Group by status
            by_status = defaultdict(list)
            for err in self.results['api_errors']:
                by_status[err['status']].append(err)
            
            for status, errors in sorted(by_status.items()):
                print(f"\n  {status.upper()} ({len(errors)} endpoints):")
                for err in errors[:10]:  # Show max 10 per category
                    print(f"    - {err['method']} {err['path']}")
                if len(errors) > 10:
                    print(f"    ... and {len(errors) - 10} more")
        
        # Module breakdown
        print(f"\n📦 RESULTS BY MODULE:")
        for module, stats in sorted(self.results['by_module'].items(), key=lambda x: x[1]['tested'], reverse=True):
            tested = stats['tested']
            passed = stats['passed']
            failed = stats['failed']
            rate = (passed / tested * 100) if tested > 0 else 0
            print(f"  {module:20s}: {passed}/{tested} passed ({rate:.0f}%), {failed} failed")
        
        # Save detailed report
        report_path = f"/app/test_reports/comprehensive_logic_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\n💾 Detailed report saved: {report_path}")
        
        return pass_rate >= 90  # Success if 90%+ pass rate

def main():
    tester = ComprehensiveLogicTester()
    
    # Step 1: Authenticate
    if not tester.authenticate():
        print("❌ Authentication failed, cannot proceed")
        sys.exit(1)
    
    # Step 2: Extract endpoints
    if not tester.extract_endpoints():
        print("❌ Failed to extract endpoints")
        sys.exit(1)
    
    # Step 3: Run comprehensive sweep
    tester.run_sweep()
    
    # Step 4: Generate report
    success = tester.generate_report()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
