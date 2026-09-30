"""Backend Import Integrity & Routing Test for G-H03 Refactoring.

Tests all 9 refactored modular services:
- Batch 1: reservation, ar, period (old monolithic files deleted, direct imports)
- Batch 2 & 3: finance, scheduler, bank_recon, hr_payroll, system_settings, exec_drilldown (facade pattern)

Focus:
1. Import integrity - all modular packages can be imported
2. Router imports work correctly
3. No import errors or missing modules
"""
import sys
import traceback
from typing import List, Dict, Any

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class RefactoringTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors: List[Dict[str, Any]] = []

    def test_import(self, name: str, import_func) -> bool:
        """Test if an import works without errors."""
        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing: {name}{RESET}")
        
        try:
            import_func()
            self.tests_passed += 1
            print(f"{GREEN}✅ PASS - {name} imported successfully{RESET}")
            return True
        except Exception as e:
            self.tests_failed += 1
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            self.errors.append({
                "test": name,
                "error": error_msg
            })
            print(f"{RED}❌ FAIL - {name}: {str(e)}{RESET}")
            return False

    def test_module_functions(self, name: str, module, expected_functions: List[str]) -> bool:
        """Test if a module has expected functions."""
        self.tests_run += 1
        print(f"\n{BLUE}🔍 Testing: {name} - function exports{RESET}")
        
        try:
            missing = []
            for func_name in expected_functions:
                if not hasattr(module, func_name):
                    missing.append(func_name)
            
            if missing:
                self.tests_failed += 1
                error_msg = f"Missing functions: {', '.join(missing)}"
                self.errors.append({
                    "test": f"{name} - function exports",
                    "error": error_msg
                })
                print(f"{RED}❌ FAIL - {name}: {error_msg}{RESET}")
                return False
            
            self.tests_passed += 1
            print(f"{GREEN}✅ PASS - {name} has all expected functions{RESET}")
            return True
        except Exception as e:
            self.tests_failed += 1
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            self.errors.append({
                "test": f"{name} - function exports",
                "error": error_msg
            })
            print(f"{RED}❌ FAIL - {name}: {str(e)}{RESET}")
            return False

    def print_summary(self):
        """Print test summary."""
        print(f"\n{'='*60}")
        print(f"{BLUE}📊 TEST SUMMARY{RESET}")
        print(f"{'='*60}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
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
    print("G-H03 Backend Refactoring - Import Integrity Test")
    print(f"{'='*60}{RESET}\n")
    
    tester = RefactoringTester()
    
    # ========================================
    # BATCH 1: Direct imports (no facade)
    # ========================================
    print(f"\n{YELLOW}{'='*60}")
    print("BATCH 1: Reservation, AR, Period (Direct Imports)")
    print(f"{'='*60}{RESET}")
    
    # Test 1: _reservation modular package
    def import_reservation():
        from services import _reservation
        return _reservation
    
    if tester.test_import("services._reservation", import_reservation):
        from services import _reservation
        tester.test_module_functions(
            "services._reservation",
            _reservation,
            ["create_reservation", "list_reservations", "get_reservation", 
             "update_reservation", "delete_reservation", "executive_summary"]
        )
    
    # Test 2: _ar modular package
    def import_ar():
        from services import _ar
        return _ar
    
    if tester.test_import("services._ar", import_ar):
        from services import _ar
        tester.test_module_functions(
            "services._ar",
            _ar,
            ["create_invoice", "list_invoices", "get_invoice", 
             "ar_aging", "aging_report", "create_customer"]
        )
    
    # Test 3: _period modular package
    def import_period():
        from services import _period
        return _period
    
    if tester.test_import("services._period", import_period):
        from services import _period
        tester.test_module_functions(
            "services._period",
            _period,
            ["list_periods", "get_period", "close_period", 
             "lock_period", "reopen_period", "is_period_locked"]
        )
    
    # ========================================
    # BATCH 2 & 3: Facade pattern
    # ========================================
    print(f"\n{YELLOW}{'='*60}")
    print("BATCH 2 & 3: Finance, Scheduler, Bank Recon, HR Payroll, System Settings, Exec Drilldown (Facade Pattern)")
    print(f"{'='*60}{RESET}")
    
    # Test 4: _finance modular package
    def import_finance_modular():
        from services import _finance
        return _finance
    
    if tester.test_import("services._finance", import_finance_modular):
        from services import _finance
        tester.test_module_functions(
            "services._finance",
            _finance,
            ["list_journals", "get_journal", "post_manual_journal", 
             "trial_balance", "profit_loss", "ap_aging"]
        )
    
    # Test 5: finance_service facade
    def import_finance_facade():
        from services import finance_service
        return finance_service
    
    if tester.test_import("services.finance_service", import_finance_facade):
        from services import finance_service
        tester.test_module_functions(
            "services.finance_service",
            finance_service,
            ["list_journals", "get_journal", "post_manual_journal", 
             "trial_balance", "profit_loss", "ap_aging"]
        )
    
    # Test 6: _scheduler modular package
    def import_scheduler_modular():
        from services import _scheduler
        return _scheduler
    
    if tester.test_import("services._scheduler", import_scheduler_modular):
        from services import _scheduler
        tester.test_module_functions(
            "services._scheduler",
            _scheduler,
            ["start_scheduler", "shutdown_scheduler", "list_jobs", "run_job_now"]
        )
    
    # Test 7: scheduler_service facade
    def import_scheduler_facade():
        from services import scheduler_service
        return scheduler_service
    
    if tester.test_import("services.scheduler_service", import_scheduler_facade):
        from services import scheduler_service
        tester.test_module_functions(
            "services.scheduler_service",
            scheduler_service,
            ["start_scheduler", "shutdown_scheduler", "list_jobs", "run_job_now"]
        )
    
    # Test 8: _bank_recon modular package
    def import_bank_recon_modular():
        from services import _bank_recon
        return _bank_recon
    
    if tester.test_import("services._bank_recon", import_bank_recon_modular):
        from services import _bank_recon
        tester.test_module_functions(
            "services._bank_recon",
            _bank_recon,
            ["list_sessions", "get_session", "upload_statement", 
             "auto_match", "commit_session"]
        )
    
    # Test 9: bank_recon_service facade
    def import_bank_recon_facade():
        from services import bank_recon_service
        return bank_recon_service
    
    if tester.test_import("services.bank_recon_service", import_bank_recon_facade):
        from services import bank_recon_service
        tester.test_module_functions(
            "services.bank_recon_service",
            bank_recon_service,
            ["list_sessions", "get_session", "upload_statement", 
             "auto_match", "commit_session"]
        )
    
    # Test 10: _hr_payroll modular package
    def import_hr_payroll_modular():
        from services import _hr_payroll
        return _hr_payroll
    
    if tester.test_import("services._hr_payroll", import_hr_payroll_modular):
        from services import _hr_payroll
        tester.test_module_functions(
            "services._hr_payroll",
            _hr_payroll,
            ["list_payroll", "get_payroll", "create_payroll", 
             "approve_payroll", "post_payroll"]
        )
    
    # Test 11: hr_payroll_service facade
    def import_hr_payroll_facade():
        from services import hr_payroll_service
        return hr_payroll_service
    
    if tester.test_import("services.hr_payroll_service", import_hr_payroll_facade):
        from services import hr_payroll_service
        tester.test_module_functions(
            "services.hr_payroll_service",
            hr_payroll_service,
            ["list_payroll", "get_payroll", "create_payroll", 
             "approve_payroll", "post_payroll"]
        )
    
    # Test 12: _system_settings modular package
    def import_system_settings_modular():
        from services import _system_settings
        return _system_settings
    
    if tester.test_import("services._system_settings", import_system_settings_modular):
        from services import _system_settings
        tester.test_module_functions(
            "services._system_settings",
            _system_settings,
            ["get_value", "list_settings", "set_value", "delete_value"]
        )
    
    # Test 13: system_settings_service facade
    def import_system_settings_facade():
        from services import system_settings_service
        return system_settings_service
    
    if tester.test_import("services.system_settings_service", import_system_settings_facade):
        from services import system_settings_service
        tester.test_module_functions(
            "services.system_settings_service",
            system_settings_service,
            ["get_value", "list_settings", "set_value", "delete_value"]
        )
    
    # Test 14: _exec_drilldown modular package
    def import_exec_drilldown_modular():
        from services import _exec_drilldown
        return _exec_drilldown
    
    if tester.test_import("services._exec_drilldown", import_exec_drilldown_modular):
        from services import _exec_drilldown
        tester.test_module_functions(
            "services._exec_drilldown",
            _exec_drilldown,
            ["brand_mix", "ap_aging_summary", "brand_drilldown", "outlet_drilldown"]
        )
    
    # Test 15: executive_drilldown_service facade
    def import_exec_drilldown_facade():
        from services import executive_drilldown_service
        return executive_drilldown_service
    
    if tester.test_import("services.executive_drilldown_service", import_exec_drilldown_facade):
        from services import executive_drilldown_service
        tester.test_module_functions(
            "services.executive_drilldown_service",
            executive_drilldown_service,
            ["brand_mix", "ap_aging_summary", "brand_drilldown", "outlet_drilldown"]
        )
    
    # ========================================
    # ROUTER IMPORTS
    # ========================================
    print(f"\n{YELLOW}{'='*60}")
    print("ROUTER IMPORTS")
    print(f"{'='*60}{RESET}")
    
    # Test 16: reservations router
    def import_reservations_router():
        from routers import reservations
        return reservations
    
    tester.test_import("routers.reservations", import_reservations_router)
    
    # Test 17: ar router
    def import_ar_router():
        from routers import ar
        return ar
    
    tester.test_import("routers.ar", import_ar_router)
    
    # Test 18: finance router
    def import_finance_router():
        from routers import finance
        return finance
    
    tester.test_import("routers.finance", import_finance_router)
    
    # Test 19: bank_recon router
    def import_bank_recon_router():
        from routers import bank_recon
        return bank_recon
    
    tester.test_import("routers.bank_recon", import_bank_recon_router)
    
    # Test 20: system_settings router
    def import_system_settings_router():
        from routers import system_settings
        return system_settings
    
    tester.test_import("routers.system_settings", import_system_settings_router)
    
    # Test 21: hr router (uses hr_payroll_service)
    def import_hr_router():
        from routers import hr
        return hr
    
    tester.test_import("routers.hr", import_hr_router)
    
    # Test 22: executive router (uses executive_drilldown_service)
    def import_executive_router():
        from routers import executive
        return executive
    
    tester.test_import("routers.executive", import_executive_router)
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
