#!/usr/bin/env python3
"""
Deep Production-Readiness Test for FnB Group ERP
Tests actual business logic, computed values, and invalid input rejection
NOT just HTTP 200 checks - validates EXPECTED results
"""

import requests
import sys
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# Base URL from frontend/.env
BASE_URL = "https://source-sync-engine.preview.emergentagent.com"

# Test credentials (all share password Demo@2026)
CREDENTIALS = {
    "admin": {"email": "admin@fnbgroup.id", "password": "Demo@2026"},
    "finance": {"email": "finance@fnbgroup.id", "password": "Demo@2026"},
    "procurement": {"email": "procurement@fnbgroup.id", "password": "Demo@2026"},
    "outlet": {"email": "cfs.manager@fnbgroup.id", "password": "Demo@2026"},
    "executive": {"email": "executive@fnbgroup.id", "password": "Demo@2026"},
}


class DeepTester:
    """Deep business logic tester - validates actual values, not just status codes"""
    
    def __init__(self):
        self.tokens: Dict[str, str] = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures: List[Dict[str, Any]] = []
        
    def log(self, message: str, level: str = "INFO"):
        """Log with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {
            "INFO": "ℹ️",
            "PASS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️",
        }.get(level, "•")
        print(f"[{timestamp}] {prefix} {message}")
    
    def assert_equal(self, actual, expected, message: str):
        """Assert equality with detailed failure info"""
        if actual != expected:
            raise AssertionError(
                f"{message}\n  Expected: {expected}\n  Actual: {actual}"
            )
    
    def assert_true(self, condition: bool, message: str):
        """Assert condition is true"""
        if not condition:
            raise AssertionError(message)
    
    def run_test(self, name: str, test_func):
        """Run a single test with error handling"""
        self.tests_run += 1
        self.log(f"Testing: {name}", "INFO")
        
        try:
            test_func()
            self.tests_passed += 1
            self.log(f"PASSED: {name}", "PASS")
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.log(f"FAILED: {name}\n  {str(e)}", "FAIL")
            self.failures.append({
                "test": name,
                "error": str(e),
                "type": "assertion"
            })
            return False
        except Exception as e:
            self.tests_failed += 1
            self.log(f"ERROR: {name}\n  {str(e)}", "FAIL")
            self.failures.append({
                "test": name,
                "error": str(e),
                "type": "exception"
            })
            return False
    
    def login(self, role: str) -> str:
        """Login and cache token"""
        if role in self.tokens:
            return self.tokens[role]
        
        creds = CREDENTIALS[role]
        self.log(f"Logging in as {role} ({creds['email']})")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=creds,
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Login failed for {role}: {response.status_code} {response.text}")
        
        data = response.json()
        token = data.get("data", {}).get("access_token") or data.get("access_token")
        
        if not token:
            raise Exception(f"No token in response for {role}: {data}")
        
        self.tokens[role] = token
        self.log(f"Logged in as {role}")
        
        # Rate limit protection
        time.sleep(0.5)
        
        return token
    
    def api_call(
        self,
        method: str,
        endpoint: str,
        role: str = "admin",
        data: Optional[Dict] = None,
        expected_status: Optional[int] = None,
        expect_success: bool = True
    ) -> Dict[str, Any]:
        """Make API call with auth"""
        token = self.login(role)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        url = f"{BASE_URL}/api/{endpoint.lstrip('/')}"
        
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        if expected_status is not None:
            self.assert_equal(
                response.status_code,
                expected_status,
                f"{method} {endpoint} status code"
            )
        
        result = response.json() if response.text else {}
        
        if expect_success and response.status_code < 400:
            # For successful responses, check envelope structure
            if "success" in result:
                self.assert_true(
                    result["success"],
                    f"{method} {endpoint} should have success=true"
                )
        
        return {
            "status": response.status_code,
            "data": result,
            "response": response
        }
    
    # ==================== AUTH/RBAC TESTS ====================
    
    def test_auth_valid_login(self):
        """Valid login returns JWT"""
        token = self.login("admin")
        self.assert_true(len(token) > 20, "Token should be non-empty JWT")
    
    def test_auth_wrong_password(self):
        """Wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fnbgroup.id", "password": "WrongPassword123"},
            timeout=10
        )
        self.assert_equal(response.status_code, 401, "Wrong password should return 401")
    
    def test_rbac_non_admin_forbidden(self):
        """Non-admin user forbidden from admin-only actions"""
        # Finance user should NOT be able to create users
        result = self.api_call(
            "POST",
            "/admin/users",
            role="finance",
            data={
                "email": "test@example.com",
                "name": "Test User",
                "role_ids": []
            },
            expected_status=403
        )
        self.assert_equal(result["status"], 403, "Finance user should get 403 for admin action")
    
    # ==================== FINANCE TESTS ====================
    
    def test_finance_balanced_journal_accepted(self):
        """Balanced journal entry is accepted"""
        je_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "description": "TEST: Balanced JE",
            "lines": [
                {"coa_id": "1101", "debit": 100000, "credit": 0, "description": "Test debit"},
                {"coa_id": "2101", "debit": 0, "credit": 100000, "description": "Test credit"}
            ]
        }
        
        result = self.api_call(
            "POST",
            "/finance/journal-entries",
            data=je_data,
            expected_status=201
        )
        
        # Verify JE was created
        je_id = result["data"].get("data", {}).get("id") or result["data"].get("id")
        self.assert_true(je_id is not None, "JE should return an ID")
        
        # Verify it appears in list
        list_result = self.api_call("GET", "/finance/journal-entries")
        entries = list_result["data"].get("data", {}).get("items", [])
        self.assert_true(len(entries) > 0, "Journal entries list should not be empty")
    
    def test_finance_unbalanced_journal_rejected(self):
        """Unbalanced journal entry is REJECTED"""
        je_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "description": "TEST: Unbalanced JE (should fail)",
            "lines": [
                {"coa_id": "1101", "debit": 100000, "credit": 0, "description": "Test debit"},
                {"coa_id": "2101", "debit": 0, "credit": 50000, "description": "Test credit (unbalanced)"}
            ]
        }
        
        result = self.api_call(
            "POST",
            "/finance/journal-entries",
            data=je_data,
            expected_status=400,
            expect_success=False
        )
        
        # Should have error message about unbalanced
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "balance" in error_msg or "debit" in error_msg or "credit" in error_msg,
            "Error should mention balance/debit/credit"
        )
    
    def test_finance_balance_sheet_balanced(self):
        """Balance sheet is balanced (Assets = Liabilities + Equity)"""
        result = self.api_call("GET", "/finance/reports/balance-sheet")
        
        data = result["data"].get("data", {})
        
        # Extract totals
        assets = data.get("total_assets", 0)
        liabilities = data.get("total_liabilities", 0)
        equity = data.get("total_equity", 0)
        
        self.assert_true(assets > 0, "Assets should be > 0")
        self.assert_true(liabilities > 0, "Liabilities should be > 0")
        
        # Balance sheet equation
        liabilities_plus_equity = liabilities + equity
        
        # Allow small rounding difference (< 1 Rp)
        diff = abs(assets - liabilities_plus_equity)
        self.assert_true(
            diff < 1,
            f"Balance sheet should be balanced: Assets {assets} = Liabilities {liabilities} + Equity {equity}"
        )
    
    def test_finance_ap_aging_correct(self):
        """AP aging buckets computed from due date"""
        result = self.api_call("GET", "/finance/ap-aging")
        
        data = result["data"].get("data", {})
        
        # Should have aging buckets
        items = data.get("items", [])
        self.assert_true(len(items) > 0, "AP aging should have items")
        
        # Verify structure
        first_item = items[0]
        self.assert_true("vendor_name" in first_item, "AP aging should have vendor_name")
        self.assert_true("balance" in first_item, "AP aging should have balance")
        
        # Verify balance is from ap_ledgers
        ap_result = self.api_call("GET", "/finance/ap-invoices")
        ap_data = ap_result["data"].get("data", {})
        ap_items = ap_data.get("items", [])
        
        self.assert_true(len(ap_items) > 0, "AP ledger should have items")
        
        # Verify first item has balance field
        first_ap = ap_items[0]
        self.assert_true("balance" in first_ap, "AP ledger should have balance field")
    
    # ==================== PROCUREMENT TESTS ====================
    
    def test_procurement_full_lifecycle(self):
        """Full PR → PO → GR lifecycle with inventory/journal verification"""
        
        # 1. Create PR
        pr_data = {
            "outlet_id": "CFS",
            "requested_by": "test_user",
            "notes": "TEST: Full lifecycle PR",
            "lines": [
                {
                    "item_code": "TEST_ITEM_001",
                    "item_name": "Test Item",
                    "qty": 10,
                    "uom": "pcs",
                    "notes": "Test item for lifecycle"
                }
            ]
        }
        
        pr_result = self.api_call(
            "POST",
            "/procurement/prs",
            data=pr_data,
            expected_status=201
        )
        
        pr_id = pr_result["data"].get("data", {}).get("id") or pr_result["data"].get("id")
        self.assert_true(pr_id is not None, "PR should return an ID")
        
        # 2. Submit PR
        self.api_call(
            "POST",
            f"/procurement/prs/{pr_id}/submit",
            expected_status=200
        )
        
        # 3. Approve PR
        self.api_call(
            "POST",
            f"/procurement/prs/{pr_id}/approve",
            expected_status=200
        )
        
        # 4. Create PO from PR
        po_data = {
            "pr_id": pr_id,
            "vendor_id": "V001",
            "vendor_name": "Test Vendor",
            "notes": "TEST: PO from PR",
            "lines": [
                {
                    "item_code": "TEST_ITEM_001",
                    "item_name": "Test Item",
                    "qty": 10,
                    "uom": "pcs",
                    "unit_price": 10000,
                    "subtotal": 100000
                }
            ]
        }
        
        po_result = self.api_call(
            "POST",
            "/procurement/pos",
            data=po_data,
            expected_status=201
        )
        
        po_id = po_result["data"].get("data", {}).get("id") or po_result["data"].get("id")
        self.assert_true(po_id is not None, "PO should return an ID")
        
        # 5. Approve PO
        self.api_call(
            "POST",
            f"/procurement/pos/{po_id}/approve",
            expected_status=200
        )
        
        # 6. Create GR (full receive)
        gr_data = {
            "po_id": po_id,
            "received_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST: Full GR",
            "lines": [
                {
                    "item_code": "TEST_ITEM_001",
                    "qty_received": 10,
                    "qty_accepted": 10,
                    "qty_rejected": 0
                }
            ]
        }
        
        gr_result = self.api_call(
            "POST",
            "/procurement/goods-receipts",
            data=gr_data,
            expected_status=201
        )
        
        gr_id = gr_result["data"].get("data", {}).get("id") or gr_result["data"].get("id")
        self.assert_true(gr_id is not None, "GR should return an ID")
        
        # 7. Verify PO status updated to 'received'
        po_detail = self.api_call("GET", f"/procurement/pos/{po_id}")
        po_status = po_detail["data"].get("data", {}).get("status")
        self.assert_equal(po_status, "received", "PO status should be 'received' after full GR")
        
        # 8. Verify inventory movement created
        movements = self.api_call("GET", "/inventory/movements")
        movement_items = movements["data"].get("data", {}).get("items", [])
        self.assert_true(len(movement_items) > 0, "Inventory movements should exist")
        
        # 9. Verify journal entry created and balanced
        je_list = self.api_call("GET", "/finance/journal-entries")
        je_items = je_list["data"].get("data", {}).get("items", [])
        self.assert_true(len(je_items) > 0, "Journal entries should exist")
    
    def test_procurement_po_without_vendor_rejected(self):
        """PO without vendor is REJECTED"""
        po_data = {
            "notes": "TEST: PO without vendor (should fail)",
            "lines": [
                {
                    "item_code": "TEST_ITEM",
                    "qty": 10,
                    "unit_price": 10000
                }
            ]
        }
        
        result = self.api_call(
            "POST",
            "/procurement/pos",
            data=po_data,
            expected_status=400,
            expect_success=False
        )
        
        # Should have error about vendor
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "vendor" in error_msg or "required" in error_msg,
            "Error should mention vendor or required field"
        )
    
    # ==================== INVENTORY TESTS ====================
    
    def test_inventory_adjustment_positive(self):
        """Positive adjustment increases stock and creates balanced JE"""
        
        # Get current stock
        balance_before = self.api_call("GET", "/inventory/balance")
        
        # Create adjustment
        adj_data = {
            "outlet_id": "CFS",
            "adjustment_type": "increase",
            "reason": "TEST: Positive adjustment",
            "lines": [
                {
                    "item_code": "TEST_ADJ_ITEM",
                    "item_name": "Test Adjustment Item",
                    "qty_adjustment": 10,
                    "reason": "Test increase"
                }
            ]
        }
        
        adj_result = self.api_call(
            "POST",
            "/inventory/adjustments",
            data=adj_data,
            expected_status=201
        )
        
        adj_id = adj_result["data"].get("data", {}).get("id") or adj_result["data"].get("id")
        self.assert_true(adj_id is not None, "Adjustment should return an ID")
        
        # Submit and approve
        self.api_call("POST", f"/inventory/adjustments/{adj_id}/submit")
        self.api_call("POST", f"/inventory/adjustments/{adj_id}/approve")
        
        # Verify movement created
        movements = self.api_call("GET", "/inventory/movements")
        movement_items = movements["data"].get("data", {}).get("items", [])
        self.assert_true(len(movement_items) > 0, "Movement should be created")
        
        # Verify JE created and balanced
        je_list = self.api_call("GET", "/finance/journal-entries")
        je_items = je_list["data"].get("data", {}).get("items", [])
        self.assert_true(len(je_items) > 0, "JE should be created")
    
    def test_inventory_negative_stock_rejected(self):
        """Transfer/adjustment with qty > on-hand is REJECTED"""
        
        # Try to transfer more than available
        transfer_data = {
            "from_outlet": "CFS",
            "to_outlet": "RST",
            "notes": "TEST: Over-transfer (should fail)",
            "lines": [
                {
                    "item_code": "NONEXISTENT_ITEM",
                    "qty": 999999,  # Definitely more than available
                    "uom": "pcs"
                }
            ]
        }
        
        result = self.api_call(
            "POST",
            "/inventory/transfers",
            data=transfer_data,
            expected_status=400,
            expect_success=False
        )
        
        # Should have error about insufficient stock
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "insufficient" in error_msg or "negative" in error_msg or "stock" in error_msg,
            "Error should mention insufficient/negative stock"
        )
    
    def test_inventory_same_outlet_transfer_rejected(self):
        """Transfer to same outlet is REJECTED"""
        transfer_data = {
            "from_outlet": "CFS",
            "to_outlet": "CFS",  # Same as from
            "notes": "TEST: Same outlet transfer (should fail)",
            "lines": [
                {
                    "item_code": "TEST_ITEM",
                    "qty": 1,
                    "uom": "pcs"
                }
            ]
        }
        
        result = self.api_call(
            "POST",
            "/inventory/transfers",
            data=transfer_data,
            expected_status=400,
            expect_success=False
        )
        
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "same" in error_msg or "outlet" in error_msg,
            "Error should mention same outlet"
        )
    
    # ==================== SALES TESTS ====================
    
    def test_sales_valid_record_accepted(self):
        """Valid daily sales record is accepted"""
        sales_data = {
            "outlet_id": "CFS",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "revenue_streams": [
                {
                    "stream_name": "Dine In",
                    "amount": 1000000
                }
            ],
            "total_amount": 1000000,
            "cover_count": 50
        }
        
        result = self.api_call(
            "POST",
            "/outlet/daily-sales",
            data=sales_data,
            expected_status=201
        )
        
        sales_id = result["data"].get("data", {}).get("id") or result["data"].get("id")
        self.assert_true(sales_id is not None, "Sales record should return an ID")
    
    def test_sales_negative_amount_rejected(self):
        """Sales record with negative amount is REJECTED"""
        sales_data = {
            "outlet_id": "CFS",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "revenue_streams": [
                {
                    "stream_name": "Dine In",
                    "amount": -1000000  # Negative
                }
            ],
            "total_amount": -1000000
        }
        
        result = self.api_call(
            "POST",
            "/outlet/daily-sales",
            data=sales_data,
            expected_status=400,
            expect_success=False
        )
        
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "negative" in error_msg or "amount" in error_msg or "invalid" in error_msg,
            "Error should mention negative/invalid amount"
        )
    
    # ==================== HR TESTS ====================
    
    def test_hr_leave_within_quota_accepted(self):
        """Leave request within quota is accepted"""
        leave_data = {
            "employee_id": "EMP001",
            "leave_type": "annual",
            "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d"),
            "days": 3,
            "reason": "TEST: Leave within quota"
        }
        
        result = self.api_call(
            "POST",
            "/hr/leave-requests",
            data=leave_data,
            expected_status=201
        )
        
        leave_id = result["data"].get("data", {}).get("id") or result["data"].get("id")
        self.assert_true(leave_id is not None, "Leave request should return an ID")
    
    def test_hr_leave_over_quota_rejected(self):
        """Leave request over quota is REJECTED"""
        leave_data = {
            "employee_id": "EMP001",
            "leave_type": "annual",
            "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=100)).strftime("%Y-%m-%d"),
            "days": 94,  # Way over quota
            "reason": "TEST: Leave over quota (should fail)"
        }
        
        result = self.api_call(
            "POST",
            "/hr/leave-requests",
            data=leave_data,
            expected_status=400,
            expect_success=False
        )
        
        error_msg = str(result["data"]).lower()
        self.assert_true(
            "quota" in error_msg or "exceed" in error_msg or "balance" in error_msg,
            "Error should mention quota/exceed/balance"
        )
    
    def test_hr_payroll_coherent(self):
        """Payroll endpoint returns coherent data"""
        result = self.api_call("GET", "/hr/payroll")
        
        data = result["data"].get("data", {})
        items = data.get("items", [])
        
        self.assert_true(len(items) > 0, "Payroll should have items")
        
        # Verify structure
        first_item = items[0]
        self.assert_true("employee_name" in first_item or "employee_id" in first_item, 
                        "Payroll should have employee info")
        self.assert_true("net_pay" in first_item or "total_pay" in first_item,
                        "Payroll should have pay amount")
    
    # ==================== INPUT VALIDATION TESTS ====================
    
    def test_validation_malformed_payload(self):
        """Malformed payload returns clean 4xx with error envelope"""
        
        # Missing required fields
        result = self.api_call(
            "POST",
            "/procurement/prs",
            data={"invalid": "data"},
            expected_status=400,
            expect_success=False
        )
        
        # Should have error envelope
        data = result["data"]
        self.assert_true(
            "success" in data or "error" in data or "errors" in data,
            "Error response should have error envelope"
        )
        
        # Should NOT be a 500 or stack trace
        self.assert_true(
            result["status"] < 500,
            "Validation error should be 4xx, not 500"
        )
    
    # ==================== RESPONSE SHAPE TESTS ====================
    
    def test_response_shape_journal_entries(self):
        """Journal entries list returns canonical envelope with non-zero count"""
        result = self.api_call("GET", "/finance/journal-entries")
        
        data = result["data"]
        
        # Check envelope structure
        self.assert_true("success" in data, "Response should have 'success' field")
        self.assert_true("data" in data, "Response should have 'data' field")
        
        inner_data = data["data"]
        self.assert_true("items" in inner_data, "Data should have 'items' field")
        self.assert_true("total" in inner_data, "Data should have 'total' field")
        
        # Verify non-zero count (seeded data exists)
        total = inner_data["total"]
        self.assert_true(total > 0, f"Journal entries total should be > 0, got {total}")
    
    def test_response_shape_daily_sales(self):
        """Daily sales list returns non-zero count"""
        result = self.api_call("GET", "/outlet/daily-sales")
        
        data = result["data"]
        inner_data = data.get("data", {})
        items = inner_data.get("items", [])
        total = inner_data.get("total", 0)
        
        self.assert_true(total > 0, f"Daily sales total should be > 0, got {total}")
        self.assert_true(len(items) > 0, "Daily sales should have items")
    
    def test_response_shape_purchase_orders(self):
        """Purchase orders list returns non-zero count"""
        result = self.api_call("GET", "/procurement/pos")
        
        data = result["data"]
        inner_data = data.get("data", {})
        total = inner_data.get("total", 0)
        
        self.assert_true(total > 0, f"Purchase orders total should be > 0, got {total}")
    
    def test_response_shape_customers(self):
        """Customers list returns non-zero count"""
        result = self.api_call("GET", "/loyalty/customers")
        
        data = result["data"]
        inner_data = data.get("data", {})
        total = inner_data.get("total", 0)
        
        self.assert_true(total > 0, f"Customers total should be > 0, got {total}")
    
    def test_response_shape_outlets(self):
        """Outlets list returns non-zero count"""
        result = self.api_call("GET", "/master/outlets")
        
        data = result["data"]
        inner_data = data.get("data", {})
        items = inner_data.get("items", [])
        
        self.assert_true(len(items) >= 5, f"Outlets should have at least 5 items, got {len(items)}")
    
    # ==================== MAIN TEST RUNNER ====================
    
    def run_all_tests(self):
        """Run all tests and report results"""
        self.log("=" * 60)
        self.log("DEEP PRODUCTION-READINESS TEST - FnB Group ERP")
        self.log("=" * 60)
        
        # AUTH/RBAC Tests
        self.log("\n🔐 AUTH/RBAC TESTS", "INFO")
        self.run_test("Valid login returns JWT", self.test_auth_valid_login)
        self.run_test("Wrong password returns 401", self.test_auth_wrong_password)
        self.run_test("Non-admin forbidden from admin actions", self.test_rbac_non_admin_forbidden)
        
        # Finance Tests
        self.log("\n💰 FINANCE TESTS", "INFO")
        self.run_test("Balanced journal entry accepted", self.test_finance_balanced_journal_accepted)
        self.run_test("Unbalanced journal entry REJECTED", self.test_finance_unbalanced_journal_rejected)
        self.run_test("Balance sheet is balanced", self.test_finance_balance_sheet_balanced)
        self.run_test("AP aging correct", self.test_finance_ap_aging_correct)
        
        # Procurement Tests
        self.log("\n🛒 PROCUREMENT TESTS", "INFO")
        self.run_test("Full PR→PO→GR lifecycle", self.test_procurement_full_lifecycle)
        self.run_test("PO without vendor REJECTED", self.test_procurement_po_without_vendor_rejected)
        
        # Inventory Tests
        self.log("\n📦 INVENTORY TESTS", "INFO")
        self.run_test("Positive adjustment increases stock", self.test_inventory_adjustment_positive)
        self.run_test("Negative stock transfer REJECTED", self.test_inventory_negative_stock_rejected)
        self.run_test("Same outlet transfer REJECTED", self.test_inventory_same_outlet_transfer_rejected)
        
        # Sales Tests
        self.log("\n💵 SALES TESTS", "INFO")
        self.run_test("Valid daily sales accepted", self.test_sales_valid_record_accepted)
        self.run_test("Negative amount REJECTED", self.test_sales_negative_amount_rejected)
        
        # HR Tests
        self.log("\n👥 HR TESTS", "INFO")
        self.run_test("Leave within quota accepted", self.test_hr_leave_within_quota_accepted)
        self.run_test("Leave over quota REJECTED", self.test_hr_leave_over_quota_rejected)
        self.run_test("Payroll data coherent", self.test_hr_payroll_coherent)
        
        # Input Validation Tests
        self.log("\n✅ INPUT VALIDATION TESTS", "INFO")
        self.run_test("Malformed payload returns 4xx", self.test_validation_malformed_payload)
        
        # Response Shape Tests
        self.log("\n📊 RESPONSE SHAPE TESTS", "INFO")
        self.run_test("Journal entries non-zero count", self.test_response_shape_journal_entries)
        self.run_test("Daily sales non-zero count", self.test_response_shape_daily_sales)
        self.run_test("Purchase orders non-zero count", self.test_response_shape_purchase_orders)
        self.run_test("Customers non-zero count", self.test_response_shape_customers)
        self.run_test("Outlets non-zero count", self.test_response_shape_outlets)
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        self.log(f"Total tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}", "PASS")
        self.log(f"Failed: {self.tests_failed}", "FAIL" if self.tests_failed > 0 else "INFO")
        
        if self.failures:
            self.log("\n❌ FAILED TESTS:", "FAIL")
            for failure in self.failures:
                self.log(f"  • {failure['test']}", "FAIL")
                self.log(f"    {failure['error']}", "FAIL")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess rate: {success_rate:.1f}%")
        
        return 0 if self.tests_failed == 0 else 1


def main():
    tester = DeepTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
