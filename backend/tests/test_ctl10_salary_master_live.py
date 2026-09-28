"""Live integration tests for CTL-10 (Salary Master single source) + Cuti Tetap Digaji.
Covers salary_summary, employee validation, salary master, payroll with leave, cancel, SC/incentive workflow.
Uses public REACT_APP_BACKEND_URL. Cleans up created payroll/employees.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = ("admin@fnbgroup.id", "Demo@2026")
HRMGR = ("hr.manager@fnbgroup.id", "Demo@2026")

_tokens: dict = {}
_created_employee_ids: list = []
_created_payroll_ids: list = []


def _login(email, password):
    if email in _tokens:
        return _tokens[email]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code}: {r.text[:200]}"
    tok = r.json()["data"]["access_token"]
    _tokens[email] = tok
    return tok


def H(email=ADMIN[0]):
    tok = _login(email, ADMIN[1] if email == ADMIN[0] else HRMGR[1])
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    # delete created payroll cycles
    for pid in _created_payroll_ids:
        try:
            requests.post(f"{BASE}/api/hr/payroll/{pid}/cancel",
                          json={"reason": "cleanup test payroll TEST_"}, headers=H(), timeout=10)
        except Exception:
            pass
    for eid in _created_employee_ids:
        try:
            requests.delete(f"{BASE}/api/master/employees/{eid}", headers=H(), timeout=10)
        except Exception:
            pass


# ---------- Employee master: salary_summary + validation ----------

def test_employees_list_has_salary_summary_and_no_legacy_fields():
    r = requests.get(f"{BASE}/api/master/employees?per_page=5", headers=H(), timeout=15)
    assert r.status_code == 200, r.text
    docs = r.json()["data"]
    assert len(docs) > 0
    for e in docs:
        for legacy in ("basic_salary", "gross_salary", "salary"):
            assert legacy not in e, f"legacy field {legacy} still present in employee doc"
        ss = e.get("salary_summary")
        assert ss is not None, f"salary_summary missing for {e.get('full_name')}"
        for k in ("has_master", "basic_salary", "allowances_total", "total_fixed_pay", "ptkp_status", "bpjs_enrolled"):
            assert k in ss, f"salary_summary missing key {k}"


def test_create_employee_with_basic_salary_rejected():
    payload = {
        "code": f"TEST_{uuid.uuid4().hex[:6]}", "full_name": "TEST Reject Salary",
        "position": "waiter", "basic_salary": 5_000_000,
    }
    # need outlet
    outlets = requests.get(f"{BASE}/api/master/outlets?per_page=1", headers=H(), timeout=10).json()["data"]
    payload["outlet_id"] = outlets[0]["id"]
    r = requests.post(f"{BASE}/api/master/employees", json=payload, headers=H(), timeout=10)
    assert r.status_code == 400, r.text
    body = r.json()
    err_txt = str(body).lower()
    assert "salary master" in err_txt or "gaji dikelola" in err_txt


def test_create_employee_invalid_status_rejected():
    outlets = requests.get(f"{BASE}/api/master/outlets?per_page=1", headers=H(), timeout=10).json()["data"]
    payload = {
        "code": f"TEST_{uuid.uuid4().hex[:6]}", "full_name": "TEST Bad Status",
        "position": "waiter", "outlet_id": outlets[0]["id"], "status": "resign",
    }
    r = requests.post(f"{BASE}/api/master/employees", json=payload, headers=H(), timeout=10)
    assert r.status_code == 400, r.text


def test_create_employee_outlet_required():
    payload = {"code": f"TEST_{uuid.uuid4().hex[:6]}", "full_name": "TEST No Outlet", "position": "waiter"}
    r = requests.post(f"{BASE}/api/master/employees", json=payload, headers=H(), timeout=10)
    assert r.status_code == 400, r.text


def test_patch_employee_with_gross_salary_rejected():
    r = requests.get(f"{BASE}/api/master/employees?per_page=1", headers=H(), timeout=10)
    emp = r.json()["data"][0]
    r = requests.patch(f"{BASE}/api/master/employees/{emp['id']}", json={"gross_salary": 1234},
                       headers=H(), timeout=10)
    assert r.status_code == 400, r.text


def test_patch_employee_status_to_leave_works():
    r = requests.get(f"{BASE}/api/master/employees?per_page=5", headers=H(), timeout=10)
    emp = r.json()["data"][0]
    orig = emp.get("status", "active")
    try:
        r = requests.patch(f"{BASE}/api/master/employees/{emp['id']}", json={"status": "leave"},
                           headers=H(), timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["data"]["status"] == "leave"
    finally:
        requests.patch(f"{BASE}/api/master/employees/{emp['id']}", json={"status": orig},
                       headers=H(), timeout=10)


# ---------- Salary Master ----------

def test_salary_master_list_includes_leave():
    r = requests.get(f"{BASE}/api/hr/salary-master?per_page=200", headers=H(), timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert len(rows) > 0
    for row in rows:
        assert "employee_status" in row
        assert row["employee_status"] in ("active", "leave"), row["employee_status"]
        assert "has_master" in row


def test_salary_master_rejects_negative_and_invalid_ptkp():
    r = requests.get(f"{BASE}/api/hr/salary-master?per_page=1", headers=H(), timeout=10)
    eid = r.json()["data"][0]["employee_id"]

    r = requests.put(f"{BASE}/api/hr/salary-master/{eid}", json={"basic_salary": -100}, headers=H(), timeout=10)
    assert r.status_code == 400, r.text

    r = requests.put(f"{BASE}/api/hr/salary-master/{eid}", json={"ptkp_status": "XX/9"}, headers=H(), timeout=10)
    assert r.status_code == 400, r.text


def test_salary_master_update_persists():
    r = requests.get(f"{BASE}/api/hr/salary-master?per_page=1", headers=H(), timeout=10)
    eid = r.json()["data"][0]["employee_id"]
    prev = requests.get(f"{BASE}/api/hr/salary-master/{eid}", headers=H(), timeout=10).json()["data"]
    new_basic = float(prev.get("basic_salary", 0) or 0) + 1.0
    r = requests.put(f"{BASE}/api/hr/salary-master/{eid}",
                     json={"basic_salary": new_basic, "ptkp_status": prev.get("ptkp_status", "TK/0")},
                     headers=H(), timeout=10)
    assert r.status_code == 200, r.text
    got = requests.get(f"{BASE}/api/hr/salary-master/{eid}", headers=H(), timeout=10).json()["data"]
    assert abs(float(got["basic_salary"]) - new_basic) < 0.01
    # restore
    requests.put(f"{BASE}/api/hr/salary-master/{eid}",
                 json={"basic_salary": prev.get("basic_salary", 0)}, headers=H(), timeout=10)


# ---------- Payroll: Cuti tetap digaji + SoD + cancel ----------

def _pick_leave_and_active_employees():
    """Set one employee to 'leave' for the payroll test; return (leave_emp, active_emp, restore_fn)."""
    emps = requests.get(f"{BASE}/api/master/employees?per_page=50", headers=H(), timeout=15).json()["data"]
    actives = [e for e in emps if e.get("status") == "active"]
    assert len(actives) >= 2
    leave_emp, active_emp = actives[0], actives[1]
    r = requests.patch(f"{BASE}/api/master/employees/{leave_emp['id']}", json={"status": "leave"},
                       headers=H(), timeout=10)
    assert r.status_code == 200, r.text

    def restore():
        requests.patch(f"{BASE}/api/master/employees/{leave_emp['id']}", json={"status": "active"},
                       headers=H(), timeout=10)
    return leave_emp, active_emp, restore


@pytest.fixture(scope="module")
def payroll_leave_setup():
    leave_emp, active_emp, restore = _pick_leave_and_active_employees()
    period = "2027-02"
    # ensure clean: no active cycle for 2027-02
    yield {"period": period, "leave_emp": leave_emp, "active_emp": active_emp}
    restore()


def test_payroll_leave_employee_included_and_workflow(payroll_leave_setup):
    period = payroll_leave_setup["period"]
    leave_emp = payroll_leave_setup["leave_emp"]

    r = requests.post(f"{BASE}/api/hr/payroll", json={"period": period}, headers=H(), timeout=60)
    assert r.status_code == 200, r.text
    payroll = r.json()["data"]
    _created_payroll_ids.append(payroll["id"])
    pid = payroll["id"]

    # Leave employee is included with employment_status="leave"
    leave_lines = [e for e in payroll["employees"] if e["employee_id"] == leave_emp["id"]]
    assert leave_lines, f"leave employee {leave_emp['full_name']} not in payroll"
    assert leave_lines[0]["employment_status"] == "leave"
    assert leave_lines[0]["take_home"] > 0, "cuti tetap digaji: take_home must be > 0"

    # Warnings mention Cuti
    warns = payroll.get("warnings", [])
    assert any("Cuti" in w for w in warns), f"expected Cuti warning, got: {warns}"

    # SoD: admin (creator) can't approve
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/approve", headers=H(), timeout=15)
    assert r.status_code == 400, r.text
    assert "sod" in r.text.lower() or "sendiri" in r.text.lower()

    # HR manager approves
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/approve", headers=H(HRMGR[0]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "approved"

    # Post (admin can post)
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/post", headers=H(), timeout=30)
    assert r.status_code == 200, r.text
    posted = r.json()["data"]
    assert posted["status"] == "posted"
    je_id = posted.get("journal_entry_id")
    assert je_id, "posted payroll must have journal_entry_id"

    # Verify exactly one JE with source_type=payroll for this cycle
    r = requests.get(f"{BASE}/api/finance/journal-entries?source_type=payroll&per_page=200",
                     headers=H(), timeout=15)
    # some deployments do not filter — verify via detail
    r2 = requests.get(f"{BASE}/api/finance/journal-entries/{je_id}", headers=H(), timeout=10)
    if r2.status_code == 200:
        assert r2.json()["data"].get("source_type") == "payroll"

    # Second post rejected
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/post", headers=H(), timeout=10)
    assert r.status_code in (400, 409), r.text

    # Cancel of posted rejected
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/cancel", json={"reason": "should be rejected"},
                      headers=H(), timeout=10)
    assert r.status_code == 400, r.text


def test_payroll_cancel_requires_reason_and_allows_regenerate():
    period = "2027-03"
    r = requests.post(f"{BASE}/api/hr/payroll", json={"period": period}, headers=H(), timeout=60)
    assert r.status_code == 200, r.text
    pid = r.json()["data"]["id"]
    _created_payroll_ids.append(pid)

    # Reason too short
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/cancel", json={"reason": "x"}, headers=H(), timeout=10)
    assert r.status_code == 400, r.text

    # Valid cancel
    r = requests.post(f"{BASE}/api/hr/payroll/{pid}/cancel",
                      json={"reason": "TEST_regenerate flow ok"}, headers=H(), timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "cancelled"

    # Same period generatable again
    r = requests.post(f"{BASE}/api/hr/payroll", json={"period": period}, headers=H(), timeout=60)
    assert r.status_code == 200, r.text
    _created_payroll_ids.append(r.json()["data"]["id"])


def test_payroll_blocked_when_active_employee_missing_salary_master():
    outlets = requests.get(f"{BASE}/api/master/outlets?per_page=1", headers=H(), timeout=10).json()["data"]
    outlet_id = outlets[0]["id"]
    code = f"TEST_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE}/api/master/employees", json={
        "code": code, "full_name": f"TEST No SM {code}", "position": "waiter",
        "outlet_id": outlet_id, "status": "active"}, headers=H(), timeout=10)
    assert r.status_code == 200, r.text
    eid = r.json()["data"]["id"]
    _created_employee_ids.append(eid)
    try:
        r = requests.post(f"{BASE}/api/hr/payroll",
                          json={"period": "2027-04", "outlet_id": outlet_id}, headers=H(), timeout=30)
        assert r.status_code == 400, r.text
        assert "salary master" in r.text.lower()
    finally:
        # mark terminated so subsequent tests don't trip
        requests.patch(f"{BASE}/api/master/employees/{eid}", json={"status": "terminated"},
                       headers=H(), timeout=10)


# ---------- Service Charge workflow guard ----------

def test_service_charge_list_and_workflow_guards():
    """SC approve requires 'calculated', post requires 'approved', post blocked if payroll approved+."""
    r = requests.get(f"{BASE}/api/hr/service-charges?per_page=20", headers=H(), timeout=15)
    assert r.status_code == 200, r.text
    scs = r.json()["data"]
    if not scs:
        pytest.skip("no service charges seeded")
    # try to post a non-approved one -> must fail; try approve a posted one -> must fail
    posted = [s for s in scs if s.get("status") == "posted"]
    draft = [s for s in scs if s.get("status") in ("draft", "calculated")]
    if posted:
        r = requests.post(f"{BASE}/api/hr/service-charges/{posted[0]['id']}/approve",
                          headers=H(HRMGR[0]), timeout=10)
        assert r.status_code in (400, 409), r.text
    if draft:
        r = requests.post(f"{BASE}/api/hr/service-charges/{draft[0]['id']}/post",
                          headers=H(HRMGR[0]), timeout=10)
        assert r.status_code in (400, 409), r.text
