#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "mapollo - single-user leads/contacts manager. Supabase DB + Supabase Auth (signup/login). CSV/Excel import with header auto-match, manual mapping, preview, custom fields. Filters (title, location, country, industry, list, date range DDMMYYYY). Pagination 50/100. Export filtered results as CSV/Excel. Sample file download."

backend:
  - task: "Supabase Auth signup (auto-confirmed via admin API) and login"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "POST /api/auth/signup creates an auto-confirmed user via service_role admin.createUser then signs in and returns a session. POST /api/auth/login uses signInWithPassword. POST /api/auth/refresh refreshes token. Verified via curl: signup returns access_token (~815 chars)."
        - working: true
          agent: "testing"
          comment: "COMPREHENSIVE AUTH TESTING PASSED. All scenarios verified: (1) POST /api/auth/signup with realistic email (mapollo.qa.*@gmail.com) returns session with access_token (811 chars), (2) POST /api/auth/login with same credentials returns valid session, (3) GET /api/contacts without Bearer token correctly returns 401 Unauthorized. Auth flow is fully functional."
  - task: "Contacts CRUD + bulk import + filters + pagination + facets + export (RLS scoped per owner)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "contacts table created in Supabase (project region ap-northeast-1). Verified via curl end-to-end: POST /api/contacts (single insert) ok; POST /api/contacts/bulk inserted 2 incl custom_fields; GET /api/contacts returns count+data with page/pageSize; filter country=India -> count 1; date range fromDate=01012026&toDate=31012026 (DDMMYYYY parsed) -> count 1; GET /api/contacts/facets returns distinct countries/industries/lists; GET /api/contacts/export returns filtered rows; DELETE /api/contacts/:id implemented. All requests require Bearer token; RLS enforces owner_id."
        - working: true
          agent: "testing"
          comment: "COMPREHENSIVE CONTACTS API TESTING PASSED. All 9 test scenarios verified: (1) Single contact POST returns data with id, (2) Bulk POST with custom_fields (Seniority, Department, Budget) inserted 2 rows and custom_fields persist correctly, (3) Pagination works with page/pageSize (tested 50, 100, page=2), (4) All filters working: title (ilike), location (ilike), company (ilike), country (exact), industry (exact), list_name (exact), date range (DDMMYYYY format 01012026-31012026), (5) GET /api/contacts/facets returns distinct arrays for countries, industries, lists, (6) GET /api/contacts/export returns {data, count} and respects filters, (7) DELETE /api/contacts/:id removes contact (verified by subsequent fetch), (8) RLS isolation confirmed: second user sees 0 contacts, no ID overlap. All endpoints require Bearer token. Backend API is fully functional."

frontend:
  - task: "Login/Signup screen renders without React hydration error"
    implemented: true
    working: true
    file: "app/page.js, app/layout.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "user"
          comment: "User reported: 'A tree hydrated but some attributes of the server rendered HTML didnt match the client properties' React hydration console error."
        - working: true
          agent: "testing"
          comment: "Verified on live URL. mapollo auth screen renders (logo, email, password, submit). NO React hydration error. Sign in/Sign up toggle works. 0 console errors, 0 warnings, 0 page errors. Fix confirmed working."
        - working: true
          agent: "testing"
          comment: "VERIFIED: Fix successful. Tested at https://lead-vault-41.preview.emergentagent.com/. All tests passed: (1) Page loads correctly, (2) mapollo login/signup screen renders with all elements (branding, email input, password input, submit button), (3) NO React hydration errors detected in console, (4) Toggle between Sign in/Sign up modes works perfectly with heading and button text changing correctly, (5) Console is clean with 0 errors, 0 warnings, only 1 info message (React DevTools). The suppressHydrationWarning fix has completely resolved the hydration error."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Supabase Auth signup (auto-confirmed via admin API) and login"
    - "Contacts CRUD + bulk import + filters + pagination + facets + export (RLS scoped per owner)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Backend is fully wired to Supabase (contacts table now exists, region ap-northeast-1). Please test the backend API at base /api. AUTH FLOW: create your own user via POST /api/auth/signup {email,password} (use a realistic email like sometest+<rand>@gmail.com; the endpoint auto-confirms the user and returns session.access_token). Use that token as 'Authorization: Bearer <token>' for all /api/contacts* calls. TEST: (1) signup returns session; login works; missing/invalid token returns 401. (2) POST /api/contacts single insert. (3) POST /api/contacts/bulk with rows incl a custom_fields object. (4) GET /api/contacts?page=1&pageSize=50 returns {data,count,page,pageSize}; pageSize 100 works; pagination via page param. (5) Filters: title (ilike), location (ilike contact_location), company (ilike), country (eq company_country), industry (eq), list_name (eq), and date range fromDate/toDate in DDMMYYYY (e.g. 01012026) which maps to contact_date. (6) GET /api/contacts/facets returns countries/industries/lists arrays. (7) GET /api/contacts/export returns filtered rows. (8) DELETE /api/contacts/:id removes a row. (9) RLS: a second user must NOT see the first user's contacts. Note: single-page app so all routes are under the catch-all /api/[[...path]] route."
    - agent: "main"
      message: "Please verify ONLY the hydration/console-error fix. Load the app root URL, confirm the mapollo login/signup screen renders correctly, toggle between Sign in and Sign up, and confirm the browser console shows NO React hydration error (the 'tree hydrated but some attributes...didn't match' message) and no other blocking console errors. Do NOT attempt a full data flow yet - the Supabase 'contacts' table is pending a one-time SQL setup by the user, so backend data operations are expected to be unavailable. Scope is the auth screen render + console cleanliness only."
    - agent: "testing"
      message: "✅ HYDRATION BUG FIX VERIFIED SUCCESSFUL. Comprehensive testing completed on the auth screen at https://lead-vault-41.preview.emergentagent.com/. Results: (1) Page loads without issues, (2) All UI elements render correctly (mapollo branding, Sign in/Sign up headings, email/password inputs, submit button), (3) NO React hydration errors detected in browser console, (4) Toggle between Sign in and Sign up modes works flawlessly with proper heading and button text changes, (5) Console is completely clean - 0 errors, 0 warnings, only 1 informational React DevTools message. The suppressHydrationWarning attributes added to <html> and <body> in app/layout.js have completely resolved the reported hydration error. Task marked as working=true, needs_retesting=false, stuck_count=0. No further action needed for this bug fix."
    - agent: "testing"
      message: "✅ BACKEND API COMPREHENSIVE TESTING COMPLETED - ALL TESTS PASSED. Executed full test suite covering all 9 requested scenarios against http://localhost:3000/api. Results: (1) Auth: signup with realistic email (mapollo.qa.*@gmail.com) returns session with 811-char access_token, login works, unauthorized requests return 401 ✅ (2) Single contact POST returns data with id ✅ (3) Bulk POST with custom_fields (Seniority, Department, Budget) inserts 2 rows, custom_fields persist correctly ✅ (4) Pagination: GET /api/contacts returns {data, count, page, pageSize}, pageSize 50/100 work, page=2 pagination works ✅ (5) All filters functional: title (ilike), location (ilike), company (ilike), country (exact), industry (exact), list_name (exact), date range fromDate/toDate in DDMMYYYY format (01012026-31012026) ✅ (6) GET /api/contacts/facets returns distinct countries/industries/lists arrays ✅ (7) GET /api/contacts/export returns {data, count} and respects filters ✅ (8) DELETE /api/contacts/:id removes contact, verified by subsequent fetch ✅ (9) RLS isolation: second user sees 0 contacts, no ID overlap ✅. Backend is production-ready. Both backend tasks marked working=true, needs_retesting=false."
