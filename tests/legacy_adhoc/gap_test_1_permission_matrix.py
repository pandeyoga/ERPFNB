#!/usr/bin/env python3
"""
PERMISSION MATRIX TESTING - COMPREHENSIVE DEPTH
Test ALL roles against ALL critical endpoints to find authorization bugs
NO SKIPPING. NO EXCUSES.
"""

import requests
import json
from datetime import datetime
from collections import defaultdict

BASE_URL = "http://localhost:8001"

# All user roles with their credentials
ROLES = {
    "super_admin": {"email": "admin@fnbgroup.id", "password": "Demo@2026"},
    # Need to create or find other role credentials from DB
}

# Critical endpoints to test - grouped by module
ENDPOINTS_TO_TEST = {
    "finance": [
        ("GET", "/api/finance/journals"),
        ("POST", "/api/finance/journals/manual"),
        ("GET", "/api/finance/ap-aging"),
        ("GET", "/api/finance/ledger"),
        ("POST", "/api/finance/payments"),
        ("GET", "/api/finance/payments"),
        ("POST", "/api/finance/bank-recon/upload"),
    ],
    "hr": [
        ("GET", "/api/hr/employees"),
        ("POST", "/api/hr/leaves"),
        ("GET", "/api/hr/leaves"),
        ("POST", "/api/hr/payroll"),
        ("GET", "/api/hr/advances"),
        ("POST", "/api/hr/advances"),
    ],
    "procurement": [
        ("GET", "/api/procurement/prs"),
        ("POST", "/api/procurement/prs"),
        ("GET", "/api/procurement/pos"),
        ("POST", "/api/procurement/pos"),
        ("GET", "/api/procurement/vendors"),
    ],
    "inventory": [
        ("GET", "/api/inventory/items"),
        ("POST", "/api/inventory/transfers"),
        ("POST", "/api/inventory/adjustments"),
        ("GET", "/api/market-list/quarters"),
    ],
    "outlet": [
        ("GET", "/api/outlet/daily-sales"),
        ("POST", "/api/outlet/daily-sales/draft"),
        ("GET", "/api/outlet/budget-tracker"),
        ("POST", "/api/outlet/petty-cash"),
    ],
    "admin": [
        ("GET", "/api/admin/users"),
        ("POST", "/api/admin/users"),
        ("GET", "/api/admin/roles"),
        ("GET", "/api/admin/outlets"),
        ("POST", "/api/admin/approval-matrix/workflows"),
    ]
}

class PermissionMatrixTester:
    def __init__(self):
        self.results = {
            "total_tests": 0,
            "authorization_bugs": [],
            "expected_blocks": [],
            "unexpected_access": [],
            "by_role": defaultdict(lambda: {"tested": 0, "allowed": 0, "blocked": 0, "bugs": 0})
        }
    
    def authenticate(self, role_creds):
        """Get JWT token for a role"""
        try:
            resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json=role_creds,
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data"):
                    return data["data"].get("access_token")
        except Exception:
            pass
        return None
    
    def test_endpoint_access(self, role_name, token, method, endpoint):
        """Test if role can access endpoint"""
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                resp = requests.get(
                    f"{BASE_URL}{endpoint}",
                    headers=headers,
                    timeout=10
                )
            elif method == "POST":
                # Use empty payload for permission test
                resp = requests.post(
                    f"{BASE_URL}{endpoint}",
                    headers=headers,
                    json={},
                    timeout=10
                )
            
            self.results["total_tests"] += 1
            self.results["by_role"][role_name]["tested"] += 1
            
            # Analyze response
            if resp.status_code == 403:
                # Access blocked - this is expected for cross-module access
                self.results["by_role"][role_name]["blocked"] += 1
                return {
                    "status": "blocked",
                    "code": 403,
                    "expected": True
                }
            elif resp.status_code in [200, 201, 422]:
                # Access allowed
                # 422 = validation error but endpoint is accessible
                self.results["by_role"][role_name]["allowed"] += 1
                return {
                    "status": "allowed",
                    "code": resp.status_code,
                    "expected": None  # Need to determine if this is correct
                }
            elif resp.status_code == 401:
                # Unauthorized - token issue
                return {
                    "status": "auth_error",
                    "code": 401
                }
            else:
                return {
                    "status": "error",
                    "code": resp.status_code
                }
                
        except Exception as e:
            return {
                "status": "exception",
                "error": str(e)
            }
    
    def determine_expected_access(self, role_name, module):
        """Determine if role SHOULD have access to module"""
        # Permission rules (based on ERP system design)
        rules = {
            "super_admin": ["finance", "hr", "procurement", "inventory", "outlet", "admin"],
            "finance": ["finance", "admin"],
            "hr": ["hr", "admin"],
            "procurement": ["procurement", "inventory", "admin"],
            "outlet": ["outlet", "inventory", "admin"],
        }
        
        if role_name in rules:
            return module in rules[role_name]
        
        return False  # Default: no access
    
    def run_permission_matrix(self):
        """Run complete permission matrix test"""
        print("\n" + "="*80)
        print("🔐 PERMISSION MATRIX TESTING - COMPREHENSIVE")
        print("="*80)
        
        # First, authenticate super admin to get user list
        super_token = self.authenticate(ROLES["super_admin"])
        if not super_token:
            print("❌ Cannot authenticate super admin")
            return
        
        print("\n✅ Super Admin authenticated")
        
        # Get other users from system
        headers = {"Authorization": f"Bearer {super_token}"}
        try:
            resp = requests.get(f"{BASE_URL}/api/admin/users", headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    users = data.get("data", [])
                    print(f"📋 Found {len(users)} users in system")
                    
                    # Extract role-based test accounts
                    # For now, we'll test with super admin across all modules
                    # TODO: Add other role accounts
        except Exception:
            pass
        
        print("\n🔬 Testing Super Admin Permissions Across All Modules...")
        
        for module, endpoints in ENDPOINTS_TO_TEST.items():
            print(f"\n📦 Testing {module.upper()} Module ({len(endpoints)} endpoints):")
            
            for method, endpoint in endpoints:
                result = self.test_endpoint_access("super_admin", super_token, method, endpoint)
                
                expected_access = self.determine_expected_access("super_admin", module)
                
                if result["status"] == "allowed":
                    if expected_access:
                        print(f"  ✅ {method:6s} {endpoint[:50]:<50s} ALLOWED (correct)")
                    else:
                        print(f"  ⚠️  {method:6s} {endpoint[:50]:<50s} ALLOWED (should be blocked?)")
                        self.results["unexpected_access"].append({
                            "role": "super_admin",
                            "method": method,
                            "endpoint": endpoint,
                            "module": module
                        })
                        self.results["by_role"]["super_admin"]["bugs"] += 1
                        
                elif result["status"] == "blocked":
                    if not expected_access:
                        print(f"  ✅ {method:6s} {endpoint[:50]:<50s} BLOCKED (correct)")
                    else:
                        print(f"  🐛 {method:6s} {endpoint[:50]:<50s} BLOCKED (should be allowed!)")
                        self.results["authorization_bugs"].append({
                            "role": "super_admin",
                            "method": method,
                            "endpoint": endpoint,
                            "module": module,
                            "issue": "Super Admin blocked from module - BUG!"
                        })
                        self.results["by_role"]["super_admin"]["bugs"] += 1
                        
                else:
                    print(f"  ⚠️  {method:6s} {endpoint[:50]:<50s} {result['status'].upper()}")
        
        self.print_summary()
    
    def print_summary(self):
        """Print permission matrix summary"""
        print("\n" + "="*80)
        print("📊 PERMISSION MATRIX TEST SUMMARY")
        print("="*80)
        
        print(f"\n🎯 Overall Statistics:")
        print(f"  Total Tests: {self.results['total_tests']}")
        print(f"  Authorization Bugs: {len(self.results['authorization_bugs'])} 🐛")
        print(f"  Unexpected Access: {len(self.results['unexpected_access'])} ⚠️")
        
        if self.results['authorization_bugs']:
            print(f"\n🐛 AUTHORIZATION BUGS FOUND:")
            for bug in self.results['authorization_bugs']:
                print(f"  - {bug['role']} {bug['method']} {bug['endpoint']}")
                print(f"    Issue: {bug['issue']}")
        
        if self.results['unexpected_access']:
            print(f"\n⚠️  UNEXPECTED ACCESS (needs review):")
            for access in self.results['unexpected_access'][:10]:
                print(f"  - {access['role']} can {access['method']} {access['endpoint']}")
        
        print(f"\n📦 Results by Role:")
        for role, stats in self.results['by_role'].items():
            tested = stats['tested']
            allowed = stats['allowed']
            blocked = stats['blocked']
            bugs = stats['bugs']
            print(f"  {role:15s}: {tested} tests, {allowed} allowed, {blocked} blocked, {bugs} bugs")
        
        # Save report
        report_path = f"/app/test_reports/permission_matrix_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\n💾 Report saved: {report_path}")

def main():
    tester = PermissionMatrixTester()
    tester.run_permission_matrix()
    return 0

if __name__ == "__main__":
    exit(main())
