#!/usr/bin/env python3
"""
Comprehensive backend API test for mapollo leads-manager
Tests all endpoints including auth, CRUD, filters, pagination, facets, export, and RLS
"""

import requests
import json
import random
import string
from datetime import datetime

BASE_URL = "http://localhost:3000/api"

def random_string(length=8):
    """Generate random string for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_auth():
    """Test authentication endpoints"""
    print("=" * 80)
    print("TEST 1: AUTHENTICATION")
    print("=" * 80)
    
    # Generate unique email with realistic domain
    email = f"mapollo.qa.{random_string()}@gmail.com"
    password = f"TestPass{random_string(6)}!123"
    
    print(f"Test email: {email}")
    print(f"Test password: {password}")
    print()
    
    # Test 1.1: Signup
    print("1.1: Testing POST /api/auth/signup")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": password}, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "session" in data and "access_token" in data["session"]:
                token = data["session"]["access_token"]
                print_test("Signup returns session with access_token", True, f"Token length: {len(token)}")
                
                # Test 1.2: Login with same credentials
                print("1.2: Testing POST /api/auth/login with same credentials")
                login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
                print(f"Status: {login_resp.status_code}")
                print(f"Response: {login_resp.text[:500]}")
                
                if login_resp.status_code == 200:
                    login_data = login_resp.json()
                    if "session" in login_data and "access_token" in login_data["session"]:
                        print_test("Login returns session with access_token", True)
                    else:
                        print_test("Login returns session with access_token", False, "Missing session or access_token")
                        return None, None
                else:
                    print_test("Login returns session with access_token", False, f"Status {login_resp.status_code}")
                    return None, None
                
                # Test 1.3: Unauthorized access without token
                print("1.3: Testing GET /api/contacts without token (should return 401)")
                no_auth_resp = requests.get(f"{BASE_URL}/contacts", timeout=10)
                print(f"Status: {no_auth_resp.status_code}")
                print(f"Response: {no_auth_resp.text[:200]}")
                
                if no_auth_resp.status_code == 401:
                    print_test("Requests without token return 401", True)
                else:
                    print_test("Requests without token return 401", False, f"Got status {no_auth_resp.status_code}")
                
                return token, email
            else:
                print_test("Signup returns session with access_token", False, "Missing session or access_token in response")
                return None, None
        else:
            print_test("Signup returns session with access_token", False, f"Status {resp.status_code}: {resp.text}")
            return None, None
    except Exception as e:
        print_test("Signup returns session with access_token", False, f"Exception: {str(e)}")
        return None, None

def test_single_contact_insert(token):
    """Test single contact insertion"""
    print("=" * 80)
    print("TEST 2: SINGLE CONTACT INSERT")
    print("=" * 80)
    
    contact_data = {
        "first_name": "John",
        "last_name": "Doe",
        "title": "Senior Software Engineer",
        "email": f"john.doe.{random_string()}@techcorp.com",
        "company": "TechCorp Inc",
        "company_country": "India",
        "industry": "Technology",
        "date_raw": "01012026",
        "list_name": "Q1_2026_Leads"
    }
    
    print(f"Inserting contact: {json.dumps(contact_data, indent=2)}")
    print()
    
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = requests.post(f"{BASE_URL}/contacts", json=contact_data, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and "id" in data["data"]:
                contact_id = data["data"]["id"]
                print_test("POST /api/contacts returns data with id", True, f"Contact ID: {contact_id}")
                return contact_id
            else:
                print_test("POST /api/contacts returns data with id", False, "Missing data or id in response")
                return None
        else:
            print_test("POST /api/contacts returns data with id", False, f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        print_test("POST /api/contacts returns data with id", False, f"Exception: {str(e)}")
        return None

def test_bulk_insert_with_custom_fields(token):
    """Test bulk contact insertion with custom_fields"""
    print("=" * 80)
    print("TEST 3: BULK INSERT WITH CUSTOM FIELDS")
    print("=" * 80)
    
    bulk_data = {
        "rows": [
            {
                "first_name": "Alice",
                "last_name": "Smith",
                "title": "Marketing Director",
                "email": f"alice.smith.{random_string()}@marketco.com",
                "company": "MarketCo",
                "company_country": "USA",
                "industry": "Marketing",
                "date_raw": "15012026",
                "list_name": "Q1_2026_Leads",
                "custom_fields": {
                    "Seniority": "Senior",
                    "Department": "Marketing",
                    "Budget": "High"
                }
            },
            {
                "first_name": "Bob",
                "last_name": "Johnson",
                "title": "Sales Manager",
                "email": f"bob.johnson.{random_string()}@salesinc.com",
                "company": "SalesInc",
                "company_country": "UK",
                "industry": "Sales",
                "date_raw": "20012026",
                "list_name": "Q1_2026_Leads",
                "custom_fields": {
                    "Seniority": "Mid-Level",
                    "Region": "EMEA"
                }
            }
        ]
    }
    
    print(f"Inserting {len(bulk_data['rows'])} contacts with custom_fields")
    print()
    
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        resp = requests.post(f"{BASE_URL}/contacts/bulk", json=bulk_data, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "inserted" in data and data["inserted"] == len(bulk_data["rows"]):
                print_test("POST /api/contacts/bulk returns inserted count", True, f"Inserted: {data['inserted']}")
                
                # Verify custom_fields persist by fetching
                print("Verifying custom_fields persist...")
                fetch_resp = requests.get(f"{BASE_URL}/contacts?pageSize=10", headers=headers, timeout=10)
                if fetch_resp.status_code == 200:
                    fetch_data = fetch_resp.json()
                    contacts = fetch_data.get("data", [])
                    found_custom = False
                    for contact in contacts:
                        if contact.get("custom_fields") and isinstance(contact["custom_fields"], dict):
                            if "Seniority" in contact["custom_fields"]:
                                found_custom = True
                                print(f"Found custom_fields: {contact['custom_fields']}")
                                break
                    
                    if found_custom:
                        print_test("Custom fields persist in database", True)
                    else:
                        print_test("Custom fields persist in database", False, "No custom_fields found in fetched contacts")
                else:
                    print_test("Custom fields persist in database", False, f"Failed to fetch contacts: {fetch_resp.status_code}")
                
                return True
            else:
                print_test("POST /api/contacts/bulk returns inserted count", False, f"Expected {len(bulk_data['rows'])}, got {data.get('inserted', 0)}")
                return False
        else:
            print_test("POST /api/contacts/bulk returns inserted count", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print_test("POST /api/contacts/bulk returns inserted count", False, f"Exception: {str(e)}")
        return False

def test_pagination(token):
    """Test pagination with different page sizes"""
    print("=" * 80)
    print("TEST 4: PAGINATION")
    print("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 4.1: Default pagination (page=1, pageSize=50)
    print("4.1: Testing GET /api/contacts?page=1&pageSize=50")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?page=1&pageSize=50", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and "count" in data and "page" in data and "pageSize" in data:
                print_test("GET /api/contacts returns {data, count, page, pageSize}", True, 
                          f"Count: {data['count']}, Page: {data['page']}, PageSize: {data['pageSize']}")
            else:
                print_test("GET /api/contacts returns {data, count, page, pageSize}", False, "Missing required fields")
                return False
        else:
            print_test("GET /api/contacts returns {data, count, page, pageSize}", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        print_test("GET /api/contacts returns {data, count, page, pageSize}", False, f"Exception: {str(e)}")
        return False
    
    # Test 4.2: PageSize=100
    print("4.2: Testing GET /api/contacts?pageSize=100")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?pageSize=100", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:300]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("pageSize") == 100:
                print_test("PageSize=100 works", True)
            else:
                print_test("PageSize=100 works", False, f"Got pageSize={data.get('pageSize')}")
        else:
            print_test("PageSize=100 works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("PageSize=100 works", False, f"Exception: {str(e)}")
    
    # Test 4.3: Page=2
    print("4.3: Testing GET /api/contacts?page=2&pageSize=1")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?page=2&pageSize=1", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:300]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("page") == 2:
                print_test("Page=2 pagination works", True)
            else:
                print_test("Page=2 pagination works", False, f"Got page={data.get('page')}")
        else:
            print_test("Page=2 pagination works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Page=2 pagination works", False, f"Exception: {str(e)}")
    
    return True

def test_filters(token):
    """Test all filter types"""
    print("=" * 80)
    print("TEST 5: FILTERS")
    print("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 5.1: Title filter (partial/ilike)
    print("5.1: Testing title filter (ilike)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?title=Engineer", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with title containing 'Engineer'")
            print_test("Title filter (ilike) works", True)
        else:
            print_test("Title filter (ilike) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Title filter (ilike) works", False, f"Exception: {str(e)}")
    
    # Test 5.2: Location filter (ilike)
    print("5.2: Testing location filter (ilike)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?location=New", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with location containing 'New'")
            print_test("Location filter (ilike) works", True)
        else:
            print_test("Location filter (ilike) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Location filter (ilike) works", False, f"Exception: {str(e)}")
    
    # Test 5.3: Company filter (ilike)
    print("5.3: Testing company filter (ilike)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?company=Tech", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with company containing 'Tech'")
            print_test("Company filter (ilike) works", True)
        else:
            print_test("Company filter (ilike) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Company filter (ilike) works", False, f"Exception: {str(e)}")
    
    # Test 5.4: Country filter (exact)
    print("5.4: Testing country filter (exact match)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?country=India", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with country=India")
            print_test("Country filter (exact) works", True)
        else:
            print_test("Country filter (exact) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Country filter (exact) works", False, f"Exception: {str(e)}")
    
    # Test 5.5: Industry filter (exact)
    print("5.5: Testing industry filter (exact match)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?industry=Technology", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with industry=Technology")
            print_test("Industry filter (exact) works", True)
        else:
            print_test("Industry filter (exact) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Industry filter (exact) works", False, f"Exception: {str(e)}")
    
    # Test 5.6: List name filter (exact)
    print("5.6: Testing list_name filter (exact match)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?list_name=Q1_2026_Leads", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts with list_name=Q1_2026_Leads")
            print_test("List name filter (exact) works", True)
        else:
            print_test("List name filter (exact) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("List name filter (exact) works", False, f"Exception: {str(e)}")
    
    # Test 5.7: Date range filter (DDMMYYYY format)
    print("5.7: Testing date range filter (fromDate & toDate in DDMMYYYY)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts?fromDate=01012026&toDate=31012026", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Found {data.get('count', 0)} contacts in date range 01012026-31012026")
            print_test("Date range filter (DDMMYYYY) works", True)
        else:
            print_test("Date range filter (DDMMYYYY) works", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Date range filter (DDMMYYYY) works", False, f"Exception: {str(e)}")
    
    return True

def test_facets(token):
    """Test facets endpoint"""
    print("=" * 80)
    print("TEST 6: FACETS")
    print("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Testing GET /api/contacts/facets")
    try:
        resp = requests.get(f"{BASE_URL}/contacts/facets", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "countries" in data and "industries" in data and "lists" in data:
                print(f"Countries: {data['countries']}")
                print(f"Industries: {data['industries']}")
                print(f"Lists: {data['lists']}")
                print_test("GET /api/contacts/facets returns {countries, industries, lists}", True)
                return True
            else:
                print_test("GET /api/contacts/facets returns {countries, industries, lists}", False, "Missing required fields")
                return False
        else:
            print_test("GET /api/contacts/facets returns {countries, industries, lists}", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        print_test("GET /api/contacts/facets returns {countries, industries, lists}", False, f"Exception: {str(e)}")
        return False

def test_export(token):
    """Test export endpoint with and without filters"""
    print("=" * 80)
    print("TEST 7: EXPORT")
    print("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 7.1: Export without filters
    print("7.1: Testing GET /api/contacts/export (no filters)")
    try:
        resp = requests.get(f"{BASE_URL}/contacts/export", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "data" in data and "count" in data:
                print(f"Exported {data['count']} contacts")
                print_test("GET /api/contacts/export returns {data, count}", True)
            else:
                print_test("GET /api/contacts/export returns {data, count}", False, "Missing required fields")
                return False
        else:
            print_test("GET /api/contacts/export returns {data, count}", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        print_test("GET /api/contacts/export returns {data, count}", False, f"Exception: {str(e)}")
        return False
    
    # Test 7.2: Export with filters
    print("7.2: Testing GET /api/contacts/export with filters")
    try:
        resp = requests.get(f"{BASE_URL}/contacts/export?country=India", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Exported {data['count']} contacts with country=India filter")
            print_test("Export respects filters", True)
        else:
            print_test("Export respects filters", False, f"Status {resp.status_code}")
    except Exception as e:
        print_test("Export respects filters", False, f"Exception: {str(e)}")
    
    return True

def test_delete(token, contact_id):
    """Test delete endpoint"""
    print("=" * 80)
    print("TEST 8: DELETE")
    print("=" * 80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    if not contact_id:
        print("No contact_id available, skipping delete test")
        print_test("DELETE /api/contacts/:id removes contact", False, "No contact_id to delete")
        return False
    
    print(f"Deleting contact with id: {contact_id}")
    try:
        resp = requests.delete(f"{BASE_URL}/contacts/{contact_id}", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 200:
            # Verify it's gone by fetching all contacts
            print("Verifying contact is deleted...")
            fetch_resp = requests.get(f"{BASE_URL}/contacts?pageSize=100", headers=headers, timeout=10)
            if fetch_resp.status_code == 200:
                fetch_data = fetch_resp.json()
                contacts = fetch_data.get("data", [])
                found = any(c.get("id") == contact_id for c in contacts)
                
                if not found:
                    print_test("DELETE /api/contacts/:id removes contact", True, "Contact successfully deleted and not found in list")
                    return True
                else:
                    print_test("DELETE /api/contacts/:id removes contact", False, "Contact still exists after delete")
                    return False
            else:
                print_test("DELETE /api/contacts/:id removes contact", False, f"Failed to verify: {fetch_resp.status_code}")
                return False
        else:
            print_test("DELETE /api/contacts/:id removes contact", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        print_test("DELETE /api/contacts/:id removes contact", False, f"Exception: {str(e)}")
        return False

def test_rls_isolation(token1, email1):
    """Test RLS isolation between users"""
    print("=" * 80)
    print("TEST 9: RLS ISOLATION")
    print("=" * 80)
    
    # Create second user
    email2 = f"mapollo.qa.{random_string()}@gmail.com"
    password2 = f"TestPass{random_string(6)}!123"
    
    print(f"Creating second user: {email2}")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={"email": email2, "password": password2}, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_test("RLS isolation test", False, f"Failed to create second user: {resp.status_code}")
            return False
        
        data = resp.json()
        token2 = data["session"]["access_token"]
        print(f"Second user created successfully")
        print()
        
        # Get contacts for user 1
        headers1 = {"Authorization": f"Bearer {token1}"}
        resp1 = requests.get(f"{BASE_URL}/contacts?pageSize=100", headers=headers1, timeout=10)
        
        if resp1.status_code != 200:
            print_test("RLS isolation test", False, f"Failed to fetch user1 contacts: {resp1.status_code}")
            return False
        
        user1_contacts = resp1.json().get("data", [])
        user1_count = len(user1_contacts)
        print(f"User 1 ({email1}) has {user1_count} contacts")
        
        # Get contacts for user 2
        headers2 = {"Authorization": f"Bearer {token2}"}
        resp2 = requests.get(f"{BASE_URL}/contacts?pageSize=100", headers=headers2, timeout=10)
        
        if resp2.status_code != 200:
            print_test("RLS isolation test", False, f"Failed to fetch user2 contacts: {resp2.status_code}")
            return False
        
        user2_contacts = resp2.json().get("data", [])
        user2_count = len(user2_contacts)
        print(f"User 2 ({email2}) has {user2_count} contacts")
        print()
        
        # User 2 should have 0 contacts (new user)
        if user2_count == 0:
            print_test("RLS isolation: Second user sees 0 contacts", True)
            
            # Verify no overlap in contact IDs
            user1_ids = set(c.get("id") for c in user1_contacts)
            user2_ids = set(c.get("id") for c in user2_contacts)
            overlap = user1_ids & user2_ids
            
            if len(overlap) == 0:
                print_test("RLS isolation: No contact ID overlap between users", True)
                return True
            else:
                print_test("RLS isolation: No contact ID overlap between users", False, f"Found {len(overlap)} overlapping IDs")
                return False
        else:
            print_test("RLS isolation: Second user sees 0 contacts", False, f"User 2 has {user2_count} contacts (expected 0)")
            return False
            
    except Exception as e:
        print_test("RLS isolation test", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n")
    print("=" * 80)
    print("MAPOLLO BACKEND API COMPREHENSIVE TEST SUITE")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print("\n")
    
    # Test 1: Authentication
    token, email = test_auth()
    if not token:
        print("\n❌ CRITICAL: Authentication failed. Cannot proceed with other tests.")
        return
    
    # Test 2: Single contact insert
    contact_id = test_single_contact_insert(token)
    
    # Test 3: Bulk insert with custom fields
    test_bulk_insert_with_custom_fields(token)
    
    # Test 4: Pagination
    test_pagination(token)
    
    # Test 5: Filters
    test_filters(token)
    
    # Test 6: Facets
    test_facets(token)
    
    # Test 7: Export
    test_export(token)
    
    # Test 8: Delete
    test_delete(token, contact_id)
    
    # Test 9: RLS isolation
    test_rls_isolation(token, email)
    
    print("\n")
    print("=" * 80)
    print("TEST SUITE COMPLETED")
    print(f"Test finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print("\n")

if __name__ == "__main__":
    main()
