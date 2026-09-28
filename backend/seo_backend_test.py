"""
SEO Backend API Test — Bulk AI Optimize Feature
Tests all SEO endpoints with AI integration (EMERGENT_LLM_KEY configured)

Endpoints tested:
1. POST /api/seo/ai/generate - AI content generation
2. POST /api/seo/ai/analyze - AI keyword analysis
3. POST /api/seo/pages - upsert SEO settings
4. GET /api/seo/public?path=/ - public SEO retrieval
5. GET /api/seo/pages - list all SEO settings (auth)
"""
import requests
import sys
import json
from datetime import datetime

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

class SEOAPITester:
    def __init__(self, base_url="https://bug-fix-sprint-25.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []
        self.test_results = []

    def log_test(self, name, passed, message="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"{GREEN}✅ PASS - {name}{RESET}")
            if message:
                print(f"   {message}")
        else:
            self.tests_failed += 1
            print(f"{RED}❌ FAIL - {name}{RESET}")
            print(f"   {message}")
            self.errors.append({"test": name, "error": message})
        
        self.test_results.append({
            "test": name,
            "passed": passed,
            "message": message,
            "response_data": response_data
        })
        return passed

    def login(self, email, password):
        """Login and get token"""
        print(f"\n{BLUE}🔐 Logging in as {email}...{RESET}")
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login",
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
                print(f"{RED}❌ Login failed: {response.status_code} - {response.text}{RESET}")
                return False
        except Exception as e:
            print(f"{RED}❌ Login error: {str(e)}{RESET}")
            return False

    def test_ai_analyze(self):
        """Test POST /api/seo/ai/analyze"""
        print(f"\n{BLUE}🔍 Testing AI Keyword Analysis...{RESET}")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/seo/ai/analyze",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "path": "/",
                    "page_key": "home",
                    "page_name": "Home",
                    "keywords": "restoran bandung, cafe premium bandung, fnb bandung",
                    "page_context": "Halaman utama website FnB Group"
                },
                timeout=30
            )
            
            if response.status_code != 200:
                return self.log_test(
                    "POST /api/seo/ai/analyze",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
            
            data = response.json()
            result = data.get("data", {})
            ai_powered = data.get("meta", {}).get("ai_powered", False)
            
            # Check if AI is active
            if not ai_powered:
                return self.log_test(
                    "POST /api/seo/ai/analyze",
                    False,
                    f"AI not active (ai_powered=false). Message: {data.get('message', 'N/A')}"
                )
            
            # Validate response structure
            required_fields = ["primary_intent", "keyword_clusters", "focus_keywords"]
            missing = [f for f in required_fields if f not in result]
            
            if missing:
                return self.log_test(
                    "POST /api/seo/ai/analyze",
                    False,
                    f"Missing fields: {', '.join(missing)}"
                )
            
            # Check keyword clusters
            clusters = result.get("keyword_clusters", [])
            if not clusters:
                return self.log_test(
                    "POST /api/seo/ai/analyze",
                    False,
                    "No keyword clusters returned"
                )
            
            return self.log_test(
                "POST /api/seo/ai/analyze",
                True,
                f"AI analysis successful. Intent: {result.get('primary_intent')}, Clusters: {len(clusters)}",
                {"ai_powered": ai_powered, "clusters_count": len(clusters)}
            )
            
        except Exception as e:
            return self.log_test(
                "POST /api/seo/ai/analyze",
                False,
                f"Exception: {str(e)}"
            )

    def test_ai_generate(self):
        """Test POST /api/seo/ai/generate"""
        print(f"\n{BLUE}🎨 Testing AI Content Generation...{RESET}")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/seo/ai/generate",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "path": "/brands/the-coffeeshop",
                    "page_key": "brand-the-coffeeshop",
                    "page_name": "The Coffeeshop",
                    "keywords": "the-coffeeshop coffee bandung, specialty coffee bandung, coffeeshop premium bandung",
                    "intent": "commercial",
                    "page_context": "The Coffeeshop - specialty coffee & all-day dining"
                },
                timeout=30
            )
            
            if response.status_code != 200:
                return self.log_test(
                    "POST /api/seo/ai/generate",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
            
            data = response.json()
            result = data.get("data", {})
            ai_powered = data.get("meta", {}).get("ai_powered", False)
            
            # Check if AI is active
            if not ai_powered:
                return self.log_test(
                    "POST /api/seo/ai/generate",
                    False,
                    f"AI not active (ai_powered=false). Message: {data.get('message', 'N/A')}"
                )
            
            # Validate response structure
            required_fields = ["title", "description", "og_title", "og_description", "focus_keywords"]
            missing = [f for f in required_fields if f not in result]
            
            if missing:
                return self.log_test(
                    "POST /api/seo/ai/generate",
                    False,
                    f"Missing fields: {', '.join(missing)}"
                )
            
            # Check content quality
            title = result.get("title", "")
            description = result.get("description", "")
            
            title_len = len(title)
            desc_len = len(description)
            
            quality_issues = []
            # Allow slight variation: 48-65 for title, 145-165 for description
            if title_len < 48 or title_len > 65:
                quality_issues.append(f"Title length {title_len} (expected ~50-60)")
            if desc_len < 145 or desc_len > 165:
                quality_issues.append(f"Description length {desc_len} (expected ~148-160)")
            
            if quality_issues:
                return self.log_test(
                    "POST /api/seo/ai/generate",
                    False,
                    f"Quality issues: {', '.join(quality_issues)}. Title: '{title}', Desc: '{description}'"
                )
            
            return self.log_test(
                "POST /api/seo/ai/generate",
                True,
                f"AI generation successful. Title: {title_len} chars, Desc: {desc_len} chars",
                {
                    "ai_powered": ai_powered,
                    "title_length": title_len,
                    "description_length": desc_len,
                    "title": title,
                    "description": description
                }
            )
            
        except Exception as e:
            return self.log_test(
                "POST /api/seo/ai/generate",
                False,
                f"Exception: {str(e)}"
            )

    def test_upsert_seo_page(self):
        """Test POST /api/seo/pages (upsert)"""
        print(f"\n{BLUE}💾 Testing SEO Page Upsert...{RESET}")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/seo/pages",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "path": "/test-bulk-optimize",
                    "page_key": "test-bulk",
                    "title": "Test Bulk Optimize | FnB Group — F&B Bandung",
                    "description": "Test page for bulk optimize feature. Premium F&B experience in Bandung. Specialty coffee, fine dining, and more.",
                    "og_title": "Test Bulk Optimize — FnB Group",
                    "og_description": "Test page for bulk optimize feature testing.",
                    "og_image": "",
                    "keywords": "test, bulk, optimize, fnbgroup",
                    "focus_keywords": ["test", "bulk", "optimize"],
                    "canonical_path": "/test-bulk-optimize",
                    "noindex": False,
                    "notes": "Test page created by automated testing"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                return self.log_test(
                    "POST /api/seo/pages (upsert)",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
            
            data = response.json()
            result = data.get("data", {})
            
            # Check if UUID id is present
            if "id" not in result:
                return self.log_test(
                    "POST /api/seo/pages (upsert)",
                    False,
                    "No 'id' field in response"
                )
            
            # Validate UUID format (basic check)
            page_id = result.get("id")
            if not isinstance(page_id, str) or len(page_id) < 32:
                return self.log_test(
                    "POST /api/seo/pages (upsert)",
                    False,
                    f"Invalid UUID format: {page_id}"
                )
            
            return self.log_test(
                "POST /api/seo/pages (upsert)",
                True,
                f"SEO page saved successfully. ID: {page_id}",
                {"id": page_id, "path": result.get("path")}
            )
            
        except Exception as e:
            return self.log_test(
                "POST /api/seo/pages (upsert)",
                False,
                f"Exception: {str(e)}"
            )

    def test_get_public_seo(self):
        """Test GET /api/seo/public?path=/ (no auth)"""
        print(f"\n{BLUE}🌐 Testing Public SEO Retrieval...{RESET}")
        
        try:
            # First, ensure there's data for home page
            requests.post(
                f"{self.base_url}/api/seo/pages",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "path": "/",
                    "page_key": "home",
                    "title": "Home | FnB Group — Premium F&B Bandung",
                    "description": "FnB Group adalah multi-brand F&B terkemuka di Bandung. Nikmati pengalaman kuliner premium dari specialty coffee hingga fine dining.",
                    "keywords": "fnbgroup group, restoran bandung, cafe bandung"
                },
                timeout=10
            )
            
            # Now test public endpoint (no auth)
            response = requests.get(
                f"{self.base_url}/api/seo/public",
                params={"path": "/"},
                timeout=10
            )
            
            if response.status_code != 200:
                return self.log_test(
                    "GET /api/seo/public?path=/",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
            
            data = response.json()
            result = data.get("data")
            
            if result is None:
                return self.log_test(
                    "GET /api/seo/public?path=/",
                    True,
                    "No SEO data for path (valid response)"
                )
            
            # Check if path matches
            if result.get("path") != "/":
                return self.log_test(
                    "GET /api/seo/public?path=/",
                    False,
                    f"Path mismatch: expected '/', got '{result.get('path')}'"
                )
            
            return self.log_test(
                "GET /api/seo/public?path=/",
                True,
                f"Public SEO retrieved successfully. Title: {result.get('title', 'N/A')}"
            )
            
        except Exception as e:
            return self.log_test(
                "GET /api/seo/public?path=/",
                False,
                f"Exception: {str(e)}"
            )

    def test_list_seo_pages(self):
        """Test GET /api/seo/pages (auth required)"""
        print(f"\n{BLUE}📋 Testing List SEO Pages...{RESET}")
        
        try:
            response = requests.get(
                f"{self.base_url}/api/seo/pages",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                return self.log_test(
                    "GET /api/seo/pages",
                    False,
                    f"Status {response.status_code}: {response.text}"
                )
            
            data = response.json()
            result = data.get("data", [])
            
            if not isinstance(result, list):
                return self.log_test(
                    "GET /api/seo/pages",
                    False,
                    f"Expected list, got {type(result)}"
                )
            
            return self.log_test(
                "GET /api/seo/pages",
                True,
                f"Retrieved {len(result)} SEO pages",
                {"count": len(result)}
            )
            
        except Exception as e:
            return self.log_test(
                "GET /api/seo/pages",
                False,
                f"Exception: {str(e)}"
            )

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"{BLUE}📊 TEST SUMMARY{RESET}")
        print(f"{'='*60}")
        print(f"Total Tests: {self.tests_run}")
        print(f"{GREEN}Passed: {self.tests_passed}{RESET}")
        print(f"{RED}Failed: {self.tests_failed}{RESET}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
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
    print("SEO Backend API Test — Bulk AI Optimize Feature")
    print(f"{'='*60}{RESET}\n")
    
    tester = SEOAPITester()
    
    # Login
    if not tester.login("admin@fnbgroup.id", "Demo@2026"):
        print(f"\n{RED}❌ Login failed. Cannot proceed with tests.{RESET}")
        return 1
    
    # Run tests
    tester.test_ai_analyze()
    tester.test_ai_generate()
    tester.test_upsert_seo_page()
    tester.test_get_public_seo()
    tester.test_list_seo_pages()
    
    # Print summary
    success = tester.print_summary()
    
    # Save results to JSON
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed": tester.tests_passed,
        "failed": tester.tests_failed,
        "success_rate": f"{(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%",
        "tests": tester.test_results,
        "errors": tester.errors
    }
    
    with open("/app/backend/seo_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{BLUE}📄 Results saved to /app/backend/seo_test_results.json{RESET}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
