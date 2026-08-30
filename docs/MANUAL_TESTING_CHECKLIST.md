# FocusArx Manual Testing Checklist

## Setup Required
- [ ] Local environment configured (.env file with all vars)
- [ ] PostgreSQL database running
- [ ] API server running on port 8080
- [ ] Frontend dev server running on port 5173
- [ ] Browsers available (Chrome, Safari/Edge, mobile sim)

---

## Critical Journey 1: New User → Focus Timer → Rewards

### 1.1 Signup & Onboarding
- [ ] Visit `http://localhost:5173`
- [ ] Click "Sign Up"
- [ ] Fill form: Name, Email, Password (8+ chars)
  - [ ] Password strength meter shows ✅
  - [ ] Show/hide password works
  - [ ] Terms checkbox required
- [ ] Click "Create Account"
  - [ ] Account created in database
  - [ ] Redirected to onboarding (not login)
  - [ ] Onboarding step 1 loads (intro text)

### 1.2 Onboarding Wizard
- [ ] Step 2: "What's your goal?" 
  - [ ] Select study, productivity, or custom
  - [ ] Click next
- [ ] Step 3: "What's your challenge?"
  - [ ] Select distraction, procrastination, etc.
  - [ ] Click next
- [ ] Step 4: "Choose your style"
  - [ ] Select focus style (pomodoro, deep-work, etc.)
  - [ ] Click next
- [ ] Step 5: "Commitment"
  - [ ] Select daily hours (1-8 hours)
  - [ ] Click next
- [ ] Step 6: "Focus Guide"
  - [ ] Read focus guide for chosen style
  - [ ] Click next
- [ ] Step 7: "Ready to focus"
  - [ ] Summary of choices shown
  - [ ] Click "Start Focusing" → redirected to dashboard
  - [ ] **VERIFY:** Onboarding data saved to database (query user table)

### 1.3 Dashboard First Load
- [ ] Hero card shows "Start Focusing" CTA
- [ ] Streak counter shows "0 days" (new user)
- [ ] XP progress bar empty
- [ ] "Recent sessions" empty (no sessions yet)
- [ ] Quick-add task input visible
- [ ] Navigation menu working

### 1.4 Focus Timer Start
- [ ] Click "Start Focusing" on hero card
- [ ] Timer page loads
  - [ ] Timer countdown visible (25 min for pomodoro)
  - [ ] Play/pause buttons visible
  - [ ] Task input available ("What will you focus on?")
- [ ] Enter task title "Test Focused Work"
- [ ] Click play button
  - [ ] Timer starts counting down
  - [ ] Task locked in (can't edit during session)
  - [ ] Pause button visible (play hidden)
  - [ ] **VERIFY:** Session created in database (active_sessions table)

### 1.5 Timer Pause/Resume
- [ ] Timer running for 5-10 seconds
- [ ] Click pause button
  - [ ] Timer stops
  - [ ] Resume button visible (pause hidden)
  - [ ] **VERIFY:** activeSessionSync received
- [ ] Click resume button
  - [ ] Timer continues from where it paused
  - [ ] Time doesn't jump backward
  - [ ] **VERIFY:** Checkpoint updated in database

### 1.6 Timer Complete
- [ ] Let timer run to completion (or manually complete)
- [ ] Completion modal shows:
  - [ ] "Great work!" message
  - [ ] Focus duration: "25 minutes"
  - [ ] Reflection prompt ("How focused were you?")
  - [ ] Rewards preview: "+75 XP" and "+10 Coins"
- [ ] Click reflection (rate focus 1-5 stars)
- [ ] Click "Claim Reward"
  - [ ] Modal closes
  - [ ] Dashboard reloads
  - [ ] **VERIFY:** Session moved from active_sessions to focus_sessions
  - [ ] **VERIFY:** XP added to user_wallets
  - [ ] **VERIFY:** Streak incremented
  - [ ] Hero card now shows "1 day streak"
  - [ ] XP bar updated

### 1.7 Verify Rewards in Database
```sql
-- Run against test database
SELECT * FROM user_wallets WHERE userId = 'test-user-id' LIMIT 1;
-- Should show xp >= 75, coins >= 10

SELECT * FROM focus_sessions WHERE userId = 'test-user-id' ORDER BY createdAt DESC LIMIT 1;
-- Should show status = 'completed', durationSec = 1500 (25 min), xpEarned = 75

SELECT * FROM study_streaks WHERE userId = 'test-user-id';
-- Should show currentStreak = 1, lastSessionAt = today
```

---

## Critical Journey 2: Login → Persist Data

### 2.1 Logout
- [ ] Click user profile in top-right
- [ ] Click "Logout"
- [ ] Redirected to login page
- [ ] Session cleared from localStorage

### 2.2 Login with Email/Password
- [ ] Fill email and password
- [ ] Click "Login"
  - [ ] Redirected to dashboard
  - [ ] Previous data loaded (streak shows "1 day")
  - [ ] Recent sessions shows completed session
  - [ ] XP/coins persisted

### 2.3 Guest Login
- [ ] Visit landing page
- [ ] Click "Continue as Guest"
  - [ ] Generated guest token shown
  - [ ] Redirected to dashboard
  - [ ] Can start focus session
  - [ ] No account creation required
  - [ ] **Note:** Data persisted to localStorage, not database

---

## Journey 3: Task Management

### 3.1 Create Task
- [ ] On dashboard, find "Add Task" or "Tasks" section
- [ ] Click "Create Task" or quick-add input
- [ ] Fill form:
  - [ ] Title: "Learn React Hooks"
  - [ ] Description: "Study useEffect and custom hooks"
  - [ ] Priority: "High"
  - [ ] Due date: "Tomorrow"
  - [ ] Category: "Study"
- [ ] Click "Create"
  - [ ] Task appears in list
  - [ ] **VERIFY:** Task in database (tasks table)

### 3.2 Edit Task
- [ ] Click task in list
- [ ] Edit title to "Master React Hooks"
- [ ] Change priority to "Medium"
- [ ] Save
  - [ ] Changes persisted
  - [ ] **VERIFY:** Database updated

### 3.3 Complete Task
- [ ] Check the task checkbox or click "Complete"
  - [ ] Task marked done (strikethrough, grayed out)
  - [ ] Removed from "Active" list (still in "Completed")
  - [ ] Checkbox stays checked
  - [ ] **VERIFY:** Database status = 'completed'

### 3.4 Delete Task
- [ ] Find completed task
- [ ] Click delete/trash icon
- [ ] Confirm deletion
  - [ ] Task removed from list
  - [ ] **VERIFY:** Database record deleted or soft-deleted

### 3.5 Filter Tasks
- [ ] Click "Filter" or filter buttons
- [ ] Filter by status: "Completed"
  - [ ] Only completed tasks shown
- [ ] Filter by category: "Study"
  - [ ] Only study tasks shown
- [ ] Clear filters
  - [ ] All tasks shown

---

## Journey 4: Goal Tracking

### 4.1 Create Goal
- [ ] Navigate to Goals page
- [ ] Click "Create Goal"
- [ ] Fill form:
  - [ ] Title: "Read 10 Books This Month"
  - [ ] Target: "10 books"
  - [ ] Deadline: "End of month"
  - [ ] Description: "Science and philosophy books"
- [ ] Click "Create"
  - [ ] Goal added to list
  - [ ] Progress bar shows 0%
  - [ ] **VERIFY:** Goal in database

### 4.2 Link Session to Goal
- [ ] On goal, find "Link Sessions" or similar
- [ ] Select previous focus sessions to count toward goal
- [ ] Progress updates
  - [ ] Progress bar increased
  - [ ] Session time added to goal total

### 4.3 Track Progress
- [ ] Verify progress displayed correctly
- [ ] Complete additional sessions
- [ ] Verify progress bar updates

---

## Journey 5: Analytics

### 5.1 Dashboard Analytics
- [ ] Navigate to analytics or dashboard
- [ ] Verify charts show:
  - [ ] Total sessions: 1+
  - [ ] Total focus time: 25+ minutes
  - [ ] Streak: 1+ days
  - [ ] Weekly breakdown (if applicable)

### 5.2 Profile/Stats
- [ ] Click user profile or stats
- [ ] Verify "Wrapped" or yearly stats show:
  - [ ] Total focus time
  - [ ] Total sessions
  - [ ] Personal best streak
  - [ ] Preferred focus time of day

---

## Journey 6: Network Resilience

### 6.1 Offline Timer Start
- [ ] Open DevTools (F12)
- [ ] Click Network tab
- [ ] Check "Offline" checkbox
- [ ] Try to start focus timer
  - [ ] Timer still starts locally
  - [ ] Works without network
  - [ ] Or graceful error message

### 6.2 Offline Timer Complete
- [ ] While offline, complete a session
- [ ] Check network, turn it back on
- [ ] Verify session syncs to server
- [ ] Check database for session

### 6.3 Network Glitch Recovery
- [ ] Start focus timer
- [ ] Simulate network glitch (throttle in DevTools)
- [ ] Let timer continue
- [ ] Network recovers
- [ ] Verify data syncs correctly
- [ ] No duplicate sessions

---

## Journey 7: Mobile Responsiveness

### 7.1 Mobile Viewport (375px - iPhone X)
- [ ] Open DevTools, set device to iPhone X (375x812)
- [ ] Navigate to landing page
  - [ ] Layout adapts, no horizontal scroll
  - [ ] Touch targets >= 44px
  - [ ] Text readable without zoom
- [ ] Signup flow on mobile
  - [ ] Form fits screen
  - [ ] Keyboard doesn't break layout
- [ ] Dashboard on mobile
  - [ ] Stacked layout (mobile-first)
  - [ ] Navigation accessible
- [ ] Focus timer on mobile
  - [ ] Large touch-friendly buttons
  - [ ] Timer displays clearly
- [ ] Swipe to complete task
  - [ ] Works on mobile
  - [ ] Feedback animation plays

### 7.2 Other Mobile Sizes
- [ ] Test 320px (iPhone SE)
  - [ ] Layout still works
  - [ ] Text readable
- [ ] Test 414px (iPhone 12+)
  - [ ] Full width utilized
  - [ ] No wasted space

---

## Journey 8: Security & Edge Cases

### 8.1 Authentication Edge Cases
- [ ] Try login with wrong password
  - [ ] Error message shown
  - [ ] Account not locked (yet)
- [ ] Try login 6 times (rate limit = 5)
  - [ ] 6th attempt blocked with "Too many attempts" message
  - [ ] **VERIFY:** authLimiter working (see console logs)
- [ ] Try signup with existing email
  - [ ] Error: "Email already registered"
- [ ] Try signup with weak password (<8 chars)
  - [ ] Password strength meter shows red
  - [ ] Submit button disabled
- [ ] Try signup without terms accepted
  - [ ] Submit button disabled

### 8.2 User Isolation
- [ ] Open two browsers (or incognito windows)
- [ ] User A and User B login
- [ ] User A views tasks
- [ ] User B's tasks NOT visible to User A
- [ ] User A tries to manually access `/api/tasks?userId=B`
  - [ ] **VERIFY:** Server ignores query param
  - [ ] Only User A's tasks returned
  - [ ] **VERIFY:** Authorization working

### 8.3 Session Timeout
- [ ] Login and get access token
- [ ] Wait for token expiry (15 min or speed up in code)
- [ ] Try to make API call
  - [ ] 401 Unauthorized
  - [ ] Refresh token used automatically (if implemented)
  - [ ] Or redirected to login
- [ ] Logout clears refresh token
  - [ ] Cannot reauthenticate with same refresh token

### 8.4 Session Completion Edge Cases
- [ ] Start timer for 25 min
- [ ] Complete after 10 sec
  - [ ] Should show completion anyway
  - [ ] Verify XP awarded for actual time (10 sec, not 25 min)
- [ ] Start and immediately complete (0-1 sec)
  - [ ] Should NOT award XP (MIN_REWARD_DURATION_SEC = 600)
  - [ ] Show message "Need 10 minutes minimum"
- [ ] Complete same session twice (duplicate completion)
  - [ ] **VERIFY:** Idempotency prevents double reward
  - [ ] Check database for single reward entry
  - [ ] XP not doubled

---

## Journey 9: Admin Mode (If Enabled)

### 9.1 Admin Access
- [ ] Navigate to `/admin` or `/admin/login`
- [ ] Enter admin password
  - [ ] **Note:** Set ADMIN_PASSWORD in .env
  - [ ] If not set, should show config error
- [ ] Click login
  - [ ] Admin dashboard loaded
  - [ ] Admin cookie set (verify in DevTools)

### 9.2 Admin Functions
- [ ] View user list
- [ ] Search for user
- [ ] View user's sessions/tasks
- [ ] See if user suspension works (if implemented)

---

## Journey 10: Error Scenarios

### 10.1 API Down
- [ ] Stop API server
- [ ] Try to login on frontend
  - [ ] Show "Connection failed" or similar
  - [ ] Not a crash, graceful error

### 10.2 Database Down
- [ ] Stop PostgreSQL
- [ ] API still starts (or starts)
- [ ] Try to login
  - [ ] Show "Database connection failed"
  - [ ] Proper error message (no stack trace)

### 10.3 Missing Config
- [ ] Temporarily remove `AUTH_SECRET` from .env
- [ ] Restart API
  - [ ] Should exit with clear error message
  - [ ] Not crash silently

---

## Results Template

### Journey 1: New User → Focus Timer → Rewards
- [ ] **PASSED** / ⚠️ **ISSUES** / ❌ **FAILED**

**Issues Found:**
- (List any issues, with severity P0/P1/P2)

**Notes:**
- (Any observations)

---

**Test Date:** ___________  
**Tester Name:** ___________  
**Status:** ✅ PASSED / ⚠️ ISSUES / ❌ FAILED  
**Issues Count:** P0: __ / P1: __ / P2: __  

**Sign-off:** ___________
