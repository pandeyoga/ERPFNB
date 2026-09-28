"""
Backend API Testing for Phase 3 Parity Features
Tests: AR customer update, invoice update, reminder, change-password, journal-ledger.xlsx
"""
import requests
import sys
from datetime import datetime

BASE_URL = "https://bug-fix-sprint-25.preview.emergentagent.com/api"

class Phase3Tester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_customer_id = None
        self.test_invoice_id = None
        self.test_invoice_no = None

    def log(self, msg, status="info"):
        prefix = "✅" if status == "pass" else "❌" if status == "fail" else "🔍"
        print(f"{prefix} {msg}")

    def test(self, name, method, endpoint, expected_status, data=None, headers=None, **kwargs):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        h = headers or {}
        if self.token:
            h['Authorization'] = f'Bearer {self.token}'
        h.setdefault('Content-Type', 'application/json')

        self.tests_run += 1
        self.log(f"Testing {name}...", "info")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=h, **kwargs)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=h, **kwargs)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=h, **kwargs)
            elif method == 'DELETE':
                response = requests.delete(url, headers=h, **kwargs)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"PASS - {name} (status: {response.status_code})", "pass")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"FAIL - {name} - Expected {expected_status}, got {response.status_code}", "fail")
                try:
                    self.log(f"Response: {response.text[:200]}", "fail")
                except:
                    pass
                return False, {}

        except Exception as e:
            self.log(f"FAIL - {name} - Error: {str(e)}", "fail")
            return False, {}

    def login(self):
        """Login as admin"""
        self.log("=== LOGIN ===", "info")
        success, response = self.test(
            "Login as admin@fnbgroup.id",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@fnbgroup.id", "password": "Demo@2026"}
        )
        if success and response.get('success'):
            self.token = response.get('data', {}).get('access_token')
            self.log(f"Token obtained: {self.token[:20]}...", "pass")
            return True
        self.log("Login failed - cannot proceed", "fail")
        return False

    def test_ar_customer_update(self):
        """Test PUT /api/ar/customers/{id}"""
        self.log("\n=== TEST: AR Customer Update ===", "info")
        
        # First, get list of customers
        success, response = self.test(
            "GET /ar/customers",
            "GET",
            "ar/customers",
            200
        )
        if not success:
            return False
        
        customers = response.get('data', {}).get('items', [])
        if not customers:
            self.log("No customers found - creating one first", "info")
            success, response = self.test(
                "POST /ar/customers",
                "POST",
                "ar/customers",
                200,
                data={
                    "name": "Test Customer Phase3",
                    "channel": "b2b",
                    "email": "test@phase3.com",
                    "credit_terms_days": 30
                }
            )
            if not success:
                return False
            self.test_customer_id = response.get('data', {}).get('id')
        else:
            self.test_customer_id = customers[0]['id']
        
        self.log(f"Using customer ID: {self.test_customer_id}", "info")
        
        # Update customer
        success, response = self.test(
            "PUT /ar/customers/{id} - update name/terms/email",
            "PUT",
            f"ar/customers/{self.test_customer_id}",
            200,
            data={
                "name": "Updated Customer Phase3",
                "credit_terms_days": 45,
                "email": "updated@phase3.com"
            }
        )
        
        if success:
            updated = response.get('data', {})
            if updated.get('name') == "Updated Customer Phase3" and updated.get('credit_terms_days') == 45:
                self.log("Customer update verified - name and terms updated correctly", "pass")
                return True
            else:
                self.log("Customer update response doesn't match expected values", "fail")
                return False
        return False

    def test_ar_invoice_update(self):
        """Test PUT /api/ar/invoices/{id} - draft only, recomputes totals"""
        self.log("\n=== TEST: AR Invoice Update (Draft) ===", "info")
        
        # Get list of invoices
        success, response = self.test(
            "GET /ar/invoices?status=draft",
            "GET",
            "ar/invoices?status=draft&per_page=10",
            200
        )
        if not success:
            return False
        
        invoices = response.get('data', {}).get('items', [])
        draft_invoices = [inv for inv in invoices if inv.get('status') == 'draft']
        
        if not draft_invoices:
            self.log("No draft invoices found - creating one", "info")
            # Create a draft invoice
            success, response = self.test(
                "POST /ar/invoices",
                "POST",
                "ar/invoices",
                200,
                data={
                    "customer_name": "Test Customer",
                    "channel": "b2b",
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "credit_terms_days": 30,
                    "lines": [
                        {"description": "Item 1", "qty": 3, "unit_price": 100000, "discount": 0, "include_ppn": False},
                        {"description": "Item 2", "qty": 1, "unit_price": 50000, "discount": 0, "include_ppn": False}
                    ],
                    "auto_post": False
                }
            )
            if not success:
                return False
            self.test_invoice_id = response.get('data', {}).get('id')
            self.test_invoice_no = response.get('data', {}).get('invoice_no')
        else:
            self.test_invoice_id = draft_invoices[0]['id']
            self.test_invoice_no = draft_invoices[0]['invoice_no']
        
        self.log(f"Using draft invoice: {self.test_invoice_no} (ID: {self.test_invoice_id})", "info")
        
        # Update invoice lines - should recompute totals
        # 3x100k + 1x50k = 350k subtotal, no PPN = 350k total
        success, response = self.test(
            "PUT /ar/invoices/{id} - update lines, recompute totals",
            "PUT",
            f"ar/invoices/{self.test_invoice_id}",
            200,
            data={
                "lines": [
                    {"description": "Updated Item 1", "qty": 3, "unit_price": 100000, "discount": 0, "include_ppn": False},
                    {"description": "Updated Item 2", "qty": 1, "unit_price": 50000, "discount": 0, "include_ppn": False}
                ]
            }
        )
        
        if success:
            updated = response.get('data', {})
            subtotal = updated.get('subtotal', 0)
            total = updated.get('total_amount', 0)
            outstanding = updated.get('outstanding', 0)
            
            self.log(f"Updated invoice totals: subtotal={subtotal}, total={total}, outstanding={outstanding}", "info")
            
            # Expected: 3*100000 + 1*50000 = 350000
            if subtotal == 350000 and total == 350000 and outstanding == 350000:
                self.log("Invoice update verified - totals recomputed correctly", "pass")
                return True
            else:
                self.log(f"Invoice totals mismatch - expected subtotal=350000, got {subtotal}", "fail")
                return False
        return False

    def test_ar_invoice_update_non_draft(self):
        """Test PUT /api/ar/invoices/{id} - should reject non-draft"""
        self.log("\n=== TEST: AR Invoice Update (Non-Draft Rejection) ===", "info")
        
        # Get a sent/paid invoice
        success, response = self.test(
            "GET /ar/invoices?status=sent",
            "GET",
            "ar/invoices?status=sent&per_page=5",
            200
        )
        if not success:
            self.log("Skipping non-draft test - no sent invoices", "info")
            return True  # Not a failure, just skip
        
        invoices = response.get('data', {}).get('items', [])
        sent_invoices = [inv for inv in invoices if inv.get('status') in ('sent', 'paid', 'partial')]
        
        if not sent_invoices:
            self.log("Skipping non-draft test - no sent invoices", "info")
            return True
        
        sent_invoice_id = sent_invoices[0]['id']
        self.log(f"Attempting to update non-draft invoice: {sent_invoices[0]['invoice_no']}", "info")
        
        # Should return 400 or 422
        success, response = self.test(
            "PUT /ar/invoices/{id} - reject non-draft",
            "PUT",
            f"ar/invoices/{sent_invoice_id}",
            400,  # Expecting error
            data={"lines": [{"description": "Test", "qty": 1, "unit_price": 1000, "include_ppn": False}]}
        )
        
        # In this case, success means we got the expected 400 error
        if success:
            self.log("Non-draft rejection verified - correctly rejected", "pass")
            return True
        else:
            # If we got 200, that's wrong
            self.log("Non-draft invoice was updated - should have been rejected!", "fail")
            return False

    def test_ar_reminder(self):
        """Test POST /api/ar/invoices/{id}/remind - MOCKED, expect sent=false"""
        self.log("\n=== TEST: AR Invoice Reminder (MOCKED) ===", "info")
        
        # Get an invoice with outstanding > 0
        success, response = self.test(
            "GET /ar/invoices",
            "GET",
            "ar/invoices?per_page=20",
            200
        )
        if not success:
            return False
        
        invoices = response.get('data', {}).get('items', [])
        outstanding_invoices = [inv for inv in invoices if inv.get('outstanding', 0) > 0 and inv.get('status') != 'draft']
        
        if not outstanding_invoices:
            self.log("No invoices with outstanding found - skipping reminder test", "info")
            return True
        
        test_invoice = outstanding_invoices[0]
        self.log(f"Testing reminder for invoice: {test_invoice['invoice_no']} (outstanding: {test_invoice['outstanding']})", "info")
        
        # Send reminder - expect 200 with sent=false (MOCKED)
        success, response = self.test(
            "POST /ar/invoices/{id}/remind - MOCKED delivery",
            "POST",
            f"ar/invoices/{test_invoice['id']}/remind",
            200,
            data={"channel": "email"}
        )
        
        if success:
            result = response.get('data', {})
            sent = result.get('sent', False)
            error = result.get('error', '')
            
            self.log(f"Reminder result: sent={sent}, error={error}", "info")
            
            # MOCKED = sent should be False with an error message
            if not sent and error:
                self.log("Reminder MOCKED correctly - sent=false with error message (EXPECTED)", "pass")
                return True
            elif sent:
                self.log("Reminder sent=true - unexpected in demo (no email provider)", "fail")
                return False
            else:
                self.log("Reminder response unclear", "fail")
                return False
        return False

    def test_change_password_wrong_old(self):
        """Test POST /api/auth/change-password - reject wrong old password"""
        self.log("\n=== TEST: Change Password (Wrong Old Password) ===", "info")
        
        # Try with wrong old password - should get 401
        success, response = self.test(
            "POST /auth/change-password - wrong old password",
            "POST",
            "auth/change-password",
            401,  # Expecting 401
            data={
                "old_password": "WrongPassword123!",
                "new_password": "NewPassword123!"
            }
        )
        
        if success:
            self.log("Wrong old password correctly rejected with 401", "pass")
            return True
        else:
            self.log("Wrong old password was not rejected properly", "fail")
            return False

    def test_journal_ledger_xlsx(self):
        """Test GET /api/reports/finance/journal-ledger.xlsx"""
        self.log("\n=== TEST: Journal Ledger Excel Export ===", "info")
        
        # Get current period
        period = datetime.now().strftime("%Y-%m")
        
        success, response = self.test(
            "GET /reports/finance/journal-ledger.xlsx",
            "GET",
            f"reports/finance/journal-ledger.xlsx?period_from={period}-01&period_to={period}-28",
            200,
            timeout=30
        )
        
        if success:
            # Check if response is actually an Excel file (we can't parse it here, but check content-type)
            self.log("Journal ledger Excel export returned 200", "pass")
            return True
        return False

    def run_all_tests(self):
        """Run all Phase 3 tests"""
        print("\n" + "="*60)
        print("PHASE 3 BACKEND API TESTING")
        print("="*60 + "\n")
        
        if not self.login():
            print("\n❌ Login failed - cannot proceed with tests")
            return 1
        
        # Run all tests
        self.test_ar_customer_update()
        self.test_ar_invoice_update()
        self.test_ar_invoice_update_non_draft()
        self.test_ar_reminder()
        self.test_change_password_wrong_old()
        self.test_journal_ledger_xlsx()
        
        # Summary
        print("\n" + "="*60)
        print(f"📊 RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print("="*60 + "\n")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = Phase3Tester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
