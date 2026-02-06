# Pull Request: Therapist API endpoints & video room support

**Branch:** `feature/therapist-api-endpoints`  
**Base:** `main` (or your default branch)

---

## Summary

This PR adds the **full set of therapist-facing API endpoints** required by the Haven Therapist mobile app: auth (send/verify OTP, onboard, me, update me, specialties), dashboard, clients, availability, wallet (balance, withdraw), notifications, and session operations (show, create video room, submit summary). It also introduces **VideoSDK integration** for creating meeting rooms and **migrations** for therapist wallet, availability, and session meeting IDs.

---

## What’s in this PR

### 1. Therapist auth (`/api/v1/therapist/auth`)

- **POST `/therapist/auth/send-otp`** (no auth)  
  - Body: `{ email }`.  
  - Validates email; rate-limits (e.g. 1 OTP per 60s per email); creates OTP record; sends email via `EmailService`; returns `{ message, expiresIn }`.  
  - Used by: mobile welcome screen “Send verification code”.

- **POST `/therapist/auth/verify-otp`** (no auth)  
  - Body: `{ email, code }`.  
  - Validates OTP; marks OTP verified; finds or creates therapist by email; if therapist has no `fullName` → returns `{ requiresOnboarding: true, email, emailVerified, message }` (no token); else returns `{ therapist, token: { type, value, expiresAt }, requiresOnboarding: false }`.  
  - Used by: mobile welcome “Verify & continue” and post-OTP redirect to onboarding or dashboard.

- **POST `/therapist/auth/onboard`** (no auth)  
  - Body: `{ email, fullName, professionalTitle, specialties[, licenseUrl, identityUrl] }`.  
  - Validates with `therapistOnboardingValidator` (e.g. specialties from enum).  
  - Ensures OTP was recently verified for that email; creates/updates therapist and returns `{ therapist, token }`.  
  - Used by: mobile onboarding “Finish Setup” on specialties step.

- **GET `/therapist/auth/me`** (therapist auth)  
  - Returns current therapist profile: id, email, fullName, professionalTitle, licenseUrl, identityUrl, specialties, emailVerified, acceptingNewClients, personalMeetingLink, availabilitySlots, lastLoginAt, createdAt.  
  - Used by: mobile profile and any “current user” needs.

- **PATCH `/therapist/auth/me`** (therapist auth)  
  - Body: `{ fullName?, professionalTitle?, licenseUrl?, identityUrl? }`.  
  - Validates with `therapistUpdateProfileValidator`; updates and returns therapist.  
  - Used by: mobile profile “Save”.

- **GET `/therapist/auth/specialties`** (no auth)  
  - Returns list of allowed specialties (from enum).  
  - Used by: mobile onboarding specialties step.

---

### 2. Therapist app routes (`/api/v1/therapist/*`) – all require therapist auth

- **GET `/therapist/dashboard`**  
  - Returns dashboard stats (e.g. sessionsToday, newRequests, monthlyRevenue, balance).  
  - Implemented in `TherapistDashboardController.index`.

- **GET `/therapist/clients`**  
  - Returns list of clients (e.g. userId, fullName, email, lastSessionAt, nextSessionAt, sessionCount).  
  - Implemented in `TherapistClientsController.index`.

- **GET `/therapist/availability`**  
  - Returns `{ acceptingNewClients, personalMeetingLink, availabilitySlots }` for the current therapist.  
  - Implemented in `TherapistAvailabilityController.show`.

- **PUT `/therapist/availability`**  
  - Body: `{ acceptingNewClients?, personalMeetingLink?, availabilitySlots? }`.  
  - Updates therapist record; returns updated availability.  
  - Implemented in `TherapistAvailabilityController.update`.

- **GET `/therapist/wallet`**  
  - Returns `{ balanceCents, balance, recentTransactions, recentWithdrawals }`.  
  - Implemented in `TherapistWalletController.index`.

- **POST `/therapist/wallet/withdraw`**  
  - Body: `{ amountCents }`.  
  - Validates amount and balance; creates withdrawal record; returns e.g. `{ withdrawal: { id }, message }`.  
  - Implemented in `TherapistWalletController.withdraw`.

- **GET `/therapist/notifications`**  
  - Returns list of notifications for the therapist.  
  - Implemented in `TherapistNotificationsController.index`.

- **PATCH `/therapist/notifications/mark-all-read`**  
  - Marks all therapist notifications as read.  
  - Implemented in `TherapistNotificationsController.markAllAsRead`.

- **PATCH `/therapist/notifications/:id`**  
  - Mark one notification read / update.  
  - Implemented in `TherapistNotificationsController.update`.

- **DELETE `/therapist/notifications/:id`**  
  - Delete one notification.  
  - Implemented in `TherapistNotificationsController.destroy`.

---

### 3. Session routes (`/api/v1/sessions`) – therapist-related

- **GET `/sessions`**  
  - Already present; used by therapist app to list sessions (guards: api, therapist).

- **GET `/sessions/:id`**  
  - Already present; used to get a single session (guards: api, therapist).

- **POST `/sessions/:id/create-room`** (therapist auth)  
  - Calls `VideoSdkService` to create a meeting; stores `meetingId` on the session; returns `{ meetingId, token }` for the client to join.  
  - Implemented in `SessionsController.createRoom`.

- **PATCH `/sessions/:id/summary`** (therapist auth)  
  - Body: `{ sentiment?, engagementLevel?, clinicalNotes, followUpAt? }`.  
  - Submits/post-processes session summary; updates session.  
  - Implemented in `SessionsController.submitSummary`.

---

### 4. VideoSDK integration

- **New: `app/services/video_sdk_service.ts`** (or equivalent)  
  - Calls VideoSDK API to create a meeting; returns `meetingId` and a short-lived token.  
  - Uses env var e.g. `VIDEO_SDK_TOKEN` (or similar) for server-side API key.

- **Config / env**  
  - `VIDEO_SDK_TOKEN` added to `.env.example` and loaded in `start/env.ts` (or your env module).

---

### 5. Database migrations

- **`meeting_id` on sessions**  
  - Migration adds column to store VideoSDK meeting id when a room is created.

- **Therapist-related fields on therapists table**  
  - e.g. `accepting_new_clients`, `personal_meeting_link`, `availability_slots` (JSONB).

- **Notifications**  
  - e.g. `therapist_id` (or similar) so notifications can be scoped to therapist.

- **Therapist wallet**  
  - New tables (or columns) for therapist wallet balance and/or **therapist_wallets**, **therapist_transactions**, **therapist_withdrawals** as per your migrations (e.g. `1769400000003_create_therapist_wallets_tables.ts`, etc.).

Exact migration filenames and column names should match your codebase (see `database/migrations/`).

---

### 6. Validators and error handling

- **Validators** (e.g. in `app/validators/auth_validator.ts`):  
  - `emailValidator`, `verifyOtpValidator`, `therapistOnboardingValidator`, `therapistUpdateProfileValidator` used by therapist auth and profile.  
  - Availability update validated (e.g. `acceptingNewClients`, `personalMeetingLink`, `availabilitySlots`).

- **Error handling**  
  - Consistent API error shape (e.g. `{ message, errors? }`); appropriate status codes (400, 401, 404, 422, 429, 500).  
  - Logging in exception handler (or controllers) for debugging and monitoring.

---

### 7. Guards and security

- Therapist routes under `/therapist` use `middleware.auth({ guards: ['therapist'] })`.  
- Auth routes that issue tokens (send-otp, verify-otp, onboard) do not require auth.  
- Session create-room and summary require therapist auth so only the assigned therapist can create the room or submit the summary.

---

## API versioning and base path

- All routes live under **`/api/v1`** (or your existing API prefix), so the mobile app uses a single base URL (e.g. `EXPO_PUBLIC_API_URL` pointing to `https://api.example.com` or `https://api.example.com/api/v1` depending on how you strip the prefix).

---

## Testing suggestions

- **Auth:** Send OTP → verify with valid/expired/wrong code → onboard with valid payload; confirm token and therapist shape.  
- **Me:** With therapist token, GET and PATCH `/therapist/auth/me`; confirm persistence.  
- **Dashboard / clients / availability / wallet / notifications:** GET (and PUT for availability) with therapist token; confirm data shape and authorization.  
- **Withdraw:** POST with valid/invalid amount; confirm balance checks and withdrawal record.  
- **Sessions:** GET list and by id; POST create-room (check VideoSDK called and meetingId stored); PATCH summary.  
- **Errors:** Invalid payloads (422), missing/invalid token (401), not-found (404), rate limit (429) where applicable.

---

## Breaking changes

- **None** for existing user/auth or session flows. New routes are additive.  
- **Env:** Backend must have `VIDEO_SDK_TOKEN` (and any other required env) set for create-room to work in production.

---

## Follow-ups (optional)

- Rate limiting for send-otp (if not already global).  
- Webhook or job to sync withdrawal status from payment provider.  
- Notifications creation (e.g. when a session is booked or a payout is made).  
- OpenAPI/Swagger tags and examples for therapist group.

---

## Files changed (high level)

- **Routes:** `start/routes.ts` – therapist auth group, therapist app group, session create-room and summary.  
- **Controllers:** `therapists_controller.ts` (sendOtp, verifyOtp, onboard, me, updateMe, specialties); `therapist_dashboard_controller.ts`, `therapist_clients_controller.ts`, `therapist_availability_controller.ts`, `therapist_wallet_controller.ts`, `therapist_notifications_controller.ts`; `sessions_controller.ts` (createRoom, submitSummary, and possibly show if added).  
- **Services:** `video_sdk_service.ts` (or equivalent).  
- **Validators:** auth/therapist validators.  
- **Migrations:** meeting_id on sessions; therapist availability and wallet-related tables/columns; notifications therapist_id (or equivalent).  
- **Config:** `.env.example`, `start/env.ts` (or env module) for VIDEO_SDK_TOKEN.  
- **Exception handler:** consistent error response and logging (if touched).
