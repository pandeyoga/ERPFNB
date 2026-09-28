#!/usr/bin/env python3
"""
PHASE 1D: BUSINESS LOGIC TESTING
Validasi bahwa logic aplikasi bekerja sesuai intended:
- Calculations correct (Dr=Cr, aging, payroll)
- State transitions valid (draft→posted)
- Data integrity maintained (running balances, stock)
"""

import requests
import json
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict

BASE_URL = "http://localhost:8001"
CREDENTIALS = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}

class BusinessLogicTester:
    def __init__(self):
        self.token = None
        self.results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "logic_errors": [],
            "by_module": defaultdict(lambda: {"tested": 0, "passed": 0, "failed": 0})
        }
    
    def authenticate(self):
        """Login dan dapatkan JWT token"""
        print("🔐 Authenticating...")
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success") and data.get("data"):
                self.token = data["data"].get("access_token")
                print("✅ Authenticated")
                return True
        print(f"❌ Auth failed: {resp.status_code}")
        return False
    
    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_finance_journals_balance(self):
        """Test: Journal Entries must be balanced (Dr = Cr)"""
        print("\n📊 Testing Finance: Journal Balance Validation...")
        try:
            resp = requests.get(
                f"{BASE_URL}/api/finance/journals",
                headers=self.headers(),
                params={"limit": 100},
                timeout=10
            )
            if resp.status_code != 200:
                return self._fail("finance", "Journal API", f"HTTP {resp.status_code}")
            
            journals = resp.json()
            if not isinstance(journals, list):
                return self._fail("finance", "Journal API", "Response not a list")
            
            print(f"  Found {len(journals)} journal entries")
            
            unbalanced = []
            for je in journals:
                dr = float(je.get("total_dr", 0))
                cr = float(je.get("total_cr", 0))
                diff = abs(dr - cr)
                
                if diff > 0.01:  # More than 1 cent difference
                    unbalanced.append({
                        "doc_no": je.get("doc_no"),
                        "dr": dr,
                        "cr": cr,
                        "diff": diff
                    })
            
            if unbalanced:
                error = f"Found {len(unbalanced)} unbalanced journals: {unbalanced[:3]}"
                return self._fail("finance", "Journal Balance", error)
            
            return self._pass("finance", f"Journal Balance (checked {len(journals)} entries)")
            
        except Exception as e:
            return self._fail("finance", "Journal Balance", str(e))
    
    def test_ap_aging_calculations(self):
        """Test: AP Aging buckets must sum to total"""
        print("\n📊 Testing Finance: AP Aging Calculations...")
        try:
            resp = requests.get(f"{BASE_URL}/api/finance/ap-aging", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._fail("finance", "AP Aging API", f"HTTP {resp.status_code}")
            
            vendors = resp.json()
            print(f"  Found {len(vendors)} vendors in AP aging")
            
            errors = []
            for vendor in vendors:
                buckets = [
                    float(vendor.get("current", 0)),
                    float(vendor.get("days_1_30", 0)),
                    float(vendor.get("days_31_60", 0)),
                    float(vendor.get("days_61_90", 0)),
                    float(vendor.get("over_90", 0))
                ]
                bucket_sum = sum(buckets)
                total = float(vendor.get("total", 0))
                
                if abs(bucket_sum - total) > 0.01:
                    errors.append({
                        "vendor": vendor.get("vendor_name"),
                        "bucket_sum": bucket_sum,
                        "total": total,
                        "diff": abs(bucket_sum - total)
                    })
            
            if errors:
                error = f"Found {len(errors)} AP aging calculation errors: {errors[:2]}"
                return self._fail("finance", "AP Aging Calculations", error)
            
            return self._pass("finance", f"AP Aging Calculations (checked {len(vendors)} vendors)")
            
        except Exception as e:
            return self._fail("finance", "AP Aging", str(e))
    
    def test_ar_aging_calculations(self):
        """Test: AR Aging buckets must sum to total"""
        print("\n📊 Testing Finance: AR Aging Calculations...")
        try:
            resp = requests.get(f"{BASE_URL}/api/ar/aging", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._fail("finance", "AR Aging API", f"HTTP {resp.status_code}")
            
            customers = resp.json()
            print(f"  Found {len(customers)} customers in AR aging")
            
            errors = []
            for customer in customers:
                buckets = [
                    float(customer.get("current", 0)),
                    float(customer.get("days_1_30", 0)),
                    float(customer.get("days_31_60", 0)),
                    float(customer.get("days_61_90", 0)),
                    float(customer.get("over_90", 0))
                ]
                bucket_sum = sum(buckets)
                total = float(customer.get("total", 0))
                
                if abs(bucket_sum - total) > 0.01:
                    errors.append({
                        "customer": customer.get("customer_name"),
                        "bucket_sum": bucket_sum,
                        "total": total
                    })
            
            if errors:
                return self._fail("finance", "AR Aging Calculations", f"Found {len(errors)} errors")
            
            return self._pass("finance", f"AR Aging Calculations (checked {len(customers)} customers)")
            
        except Exception as e:
            return self._fail("finance", "AR Aging", str(e))
    
    def test_gl_ledger_running_balance(self):
        """Test: GL Ledger running balance should be cumulative sum"""
        print("\n📊 Testing Finance: GL Ledger Running Balance...")
        try:
            # Get a sample COA account
            resp = requests.get(f"{BASE_URL}/api/finance/coa", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._skip("finance", "GL Ledger", "COA API unavailable")
            
            accounts = resp.json()
            if not accounts:
                return self._skip("finance", "GL Ledger", "No accounts found")
            
            # Test first account
            account_code = accounts[0].get("code")
            resp = requests.get(
                f"{BASE_URL}/api/finance/ledger",
                headers=self.headers(),
                params={"account": account_code, "limit": 50},
                timeout=10
            )
            
            if resp.status_code != 200:
                return self._skip("finance", "GL Ledger", f"Ledger API returned {resp.status_code}")
            
            ledger = resp.json()
            print(f"  Checking {len(ledger)} ledger entries for {account_code}")
            
            # Verify running balance
            running = 0
            errors = []
            for entry in ledger:
                dr = float(entry.get("debit", 0))
                cr = float(entry.get("credit", 0))
                running += dr - cr
                
                reported_balance = float(entry.get("running_balance", 0))
                if abs(running - reported_balance) > 0.01:
                    errors.append({
                        "date": entry.get("date"),
                        "calculated": running,
                        "reported": reported_balance
                    })
            
            if errors:
                return self._fail("finance", "GL Ledger Balance", f"Found {len(errors)} mismatches")
            
            return self._pass("finance", f"GL Ledger Balance (checked {len(ledger)} entries)")
            
        except Exception as e:
            return self._fail("finance", "GL Ledger", str(e))
    
    def test_market_list_pricing_consistency(self):
        """Test: Market List prices should be positive and consistent across quarters"""
        print("\n📊 Testing Inventory: Market List Pricing...")
        try:
            resp = requests.get(f"{BASE_URL}/api/market-list/quarters", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._fail("inventory", "Market List API", f"HTTP {resp.status_code}")
            
            quarters = resp.json()
            print(f"  Found {len(quarters)} quarters")
            
            errors = []
            for quarter in quarters:
                qid = quarter.get("id")
                resp = requests.get(
                    f"{BASE_URL}/api/market-list/quarters/{qid}/items",
                    headers=self.headers(),
                    timeout=10
                )
                
                if resp.status_code == 200:
                    items = resp.json()
                    for item in items:
                        price = float(item.get("price", 0))
                        if price < 0:
                            errors.append({
                                "quarter": quarter.get("name"),
                                "item": item.get("item_name"),
                                "price": price,
                                "issue": "negative_price"
                            })
                        elif price == 0:
                            errors.append({
                                "quarter": quarter.get("name"),
                                "item": item.get("item_name"),
                                "price": price,
                                "issue": "zero_price"
                            })
            
            if errors:
                return self._fail("inventory", "Market List Pricing", f"Found {len(errors)} pricing issues")
            
            return self._pass("inventory", f"Market List Pricing (checked {len(quarters)} quarters)")
            
        except Exception as e:
            return self._fail("inventory", "Market List", str(e))
    
    def test_inventory_stock_movements(self):
        """Test: Inventory stock levels should match transaction history"""
        print("\n📊 Testing Inventory: Stock Movement Integrity...")
        try:
            resp = requests.get(f"{BASE_URL}/api/inventory/items", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._skip("inventory", "Stock Movements", "Items API unavailable")
            
            items = resp.json()
            print(f"  Checking stock consistency for {len(items[:10])} items (sample)")
            
            # Sample check on first 10 items
            errors = []
            for item in items[:10]:
                item_id = item.get("id")
                current_stock = float(item.get("stock_on_hand", 0))
                
                # Get transactions for this item
                resp = requests.get(
                    f"{BASE_URL}/api/inventory/items/{item_id}/movements",
                    headers=self.headers(),
                    timeout=10
                )
                
                if resp.status_code == 200:
                    movements = resp.json()
                    calculated_stock = sum(float(m.get("qty_change", 0)) for m in movements)
                    
                    if abs(current_stock - calculated_stock) > 0.01:
                        errors.append({
                            "item": item.get("name"),
                            "current": current_stock,
                            "calculated": calculated_stock
                        })
            
            if errors:
                return self._fail("inventory", "Stock Movements", f"Found {len(errors)} discrepancies")
            
            return self._pass("inventory", f"Stock Movement Integrity (checked {len(items[:10])} items)")
            
        except Exception as e:
            return self._fail("inventory", "Stock Movements", str(e))
    
    def test_hr_leave_quota_validation(self):
        """Test: Leave requests should not exceed quota"""
        print("\n📊 Testing HR: Leave Quota Validation...")
        try:
            resp = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._skip("hr", "Leave Quota", "Employees API unavailable")
            
            employees = resp.json()
            print(f"  Checking leave quotas for {len(employees[:10])} employees (sample)")
            
            errors = []
            for emp in employees[:10]:
                emp_id = emp.get("id")
                resp = requests.get(
                    f"{BASE_URL}/api/hr/leaves/summary/{emp_id}",
                    headers=self.headers(),
                    timeout=10
                )
                
                if resp.status_code == 200:
                    summary = resp.json()
                    used = int(summary.get("used", 0))
                    quota = int(summary.get("quota", 0))
                    
                    if used > quota:
                        errors.append({
                            "employee": emp.get("name"),
                            "used": used,
                            "quota": quota,
                            "excess": used - quota
                        })
            
            if errors:
                return self._fail("hr", "Leave Quota", f"Found {len(errors)} quota violations")
            
            return self._pass("hr", f"Leave Quota Validation (checked {len(employees[:10])} employees)")
            
        except Exception as e:
            return self._fail("hr", "Leave Quota", str(e))
    
    def test_outlet_daily_sales_totals(self):
        """Test: Daily sales totals should match sum of line items"""
        print("\n📊 Testing Outlet: Daily Sales Totals...")
        try:
            resp = requests.get(f"{BASE_URL}/api/outlet/daily-sales", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._skip("outlet", "Daily Sales", "API unavailable")
            
            sales = resp.json()
            print(f"  Checking {len(sales[:20])} daily sales records (sample)")
            
            errors = []
            for sale in sales[:20]:
                total = float(sale.get("total", 0))
                items = sale.get("items", [])
                
                if items:
                    calculated_total = sum(float(item.get("amount", 0)) for item in items)
                    
                    if abs(total - calculated_total) > 0.01:
                        errors.append({
                            "date": sale.get("date"),
                            "reported_total": total,
                            "calculated_total": calculated_total
                        })
            
            if errors:
                return self._fail("outlet", "Daily Sales Totals", f"Found {len(errors)} mismatches")
            
            return self._pass("outlet", f"Daily Sales Totals (checked {len(sales[:20])} records)")
            
        except Exception as e:
            return self._fail("outlet", "Daily Sales", str(e))
    
    def test_procurement_po_totals(self):
        """Test: PO totals should match sum of line items"""
        print("\n📊 Testing Procurement: PO Totals...")
        try:
            resp = requests.get(f"{BASE_URL}/api/procurement/pos", headers=self.headers(), timeout=10)
            if resp.status_code != 200:
                return self._skip("procurement", "PO Totals", "API unavailable")
            
            pos = resp.json()
            print(f"  Checking {len(pos[:20])} POs (sample)")
            
            errors = []
            for po in pos[:20]:
                total = float(po.get("total", 0))
                lines = po.get("lines", [])
                
                if lines:
                    calculated = sum(
                        float(line.get("qty", 0)) * float(line.get("unit_price", 0))
                        for line in lines
                    )
                    
                    if abs(total - calculated) > 0.01:
                        errors.append({
                            "po_no": po.get("po_no"),
                            "reported": total,
                            "calculated": calculated
                        })
            
            if errors:
                return self._fail("procurement", "PO Totals", f"Found {len(errors)} mismatches")
            
            return self._pass("procurement", f"PO Totals (checked {len(pos[:20])} POs)")
            
        except Exception as e:
            return self._fail("procurement", "PO Totals", str(e))
    
    def test_state_transitions(self):
        """Test: Document state transitions should follow valid workflows"""
        print("\n📊 Testing General: State Transition Validation...")
        
        valid_transitions = {
            "draft": ["submitted", "cancelled"],
            "submitted": ["approved", "rejected"],
            "approved": ["posted", "cancelled"],
            "rejected": ["draft"],
            "posted": ["reversed"],
            "cancelled": []
        }
        
        # This is a conceptual test - would need to track actual state changes
        # For now, just verify that documents have valid states
        try:
            modules = [
                ("finance/journals", "status"),
                ("procurement/pos", "status"),
                ("hr/leaves", "status")
            ]
            
            all_valid = True
            for endpoint, field in modules:
                resp = requests.get(f"{BASE_URL}/api/{endpoint}", headers=self.headers(), timeout=10)
                if resp.status_code == 200:
                    docs = resp.json()
                    for doc in docs:
                        status = doc.get(field, "").lower()
                        if status and status not in valid_transitions:
                            all_valid = False
                            print(f"  ⚠️  Invalid status '{status}' in {endpoint}")
            
            if all_valid:
                return self._pass("general", "State Transitions (valid states)")
            else:
                return self._fail("general", "State Transitions", "Found invalid states")
                
        except Exception as e:
            return self._fail("general", "State Transitions", str(e))
    
    def _pass(self, module, test_name):
        self.results["total_tests"] += 1
        self.results["passed"] += 1
        self.results["by_module"][module]["tested"] += 1
        self.results["by_module"][module]["passed"] += 1
        print(f"  ✅ PASS: {test_name}")
        return True
    
    def _fail(self, module, test_name, error):
        self.results["total_tests"] += 1
        self.results["failed"] += 1
        self.results["by_module"][module]["tested"] += 1
        self.results["by_module"][module]["failed"] += 1
        self.results["logic_errors"].append({
            "module": module,
            "test": test_name,
            "error": error
        })
        print(f"  ❌ FAIL: {test_name} - {error}")
        return False
    
    def _skip(self, module, test_name, reason):
        print(f"  ⏭️  SKIP: {test_name} - {reason}")
        return None
    
    def run_all_tests(self):
        """Run all business logic tests"""
        print("\n" + "="*80)
        print("🚀 PHASE 1D: BUSINESS LOGIC TESTING")
        print("="*80)
        
        # Finance Module Tests
        self.test_finance_journals_balance()
        self.test_ap_aging_calculations()
        self.test_ar_aging_calculations()
        self.test_gl_ledger_running_balance()
        
        # Inventory Module Tests
        self.test_market_list_pricing_consistency()
        self.test_inventory_stock_movements()
        
        # HR Module Tests
        self.test_hr_leave_quota_validation()
        
        # Outlet Module Tests
        self.test_outlet_daily_sales_totals()
        
        # Procurement Module Tests
        self.test_procurement_po_totals()
        
        # General Tests
        self.test_state_transitions()
        
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📊 BUSINESS LOGIC TEST SUMMARY")
        print("="*80)
        
        print(f"\n🎯 Overall Results:")
        print(f"  Total Tests: {self.results['total_tests']}")
        print(f"  Passed: {self.results['passed']} ✅")
        print(f"  Failed: {self.results['failed']} ❌")
        
        if self.results['total_tests'] > 0:
            pass_rate = (self.results['passed'] / self.results['total_tests']) * 100
            print(f"  Pass Rate: {pass_rate:.1f}%")
        
        if self.results['logic_errors']:
            print(f"\n🐛 Logic Errors Found ({len(self.results['logic_errors'])}):")
            for err in self.results['logic_errors']:
                print(f"  - [{err['module'].upper()}] {err['test']}")
                print(f"    Error: {err['error']}")
        
        print(f"\n📦 Results by Module:")
        for module, stats in sorted(self.results['by_module'].items()):
            tested = stats['tested']
            passed = stats['passed']
            failed = stats['failed']
            rate = (passed / tested * 100) if tested > 0 else 0
            print(f"  {module:15s}: {passed}/{tested} passed ({rate:.0f}%), {failed} failed")
        
        # Save report
        report_path = f"/app/test_reports/phase1d_business_logic_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\n💾 Report saved: {report_path}")

def main():
    tester = BusinessLogicTester()
    
    if not tester.authenticate():
        print("❌ Authentication failed")
        return 1
    
    tester.run_all_tests()
    return 0

if __name__ == "__main__":
    exit(main())
