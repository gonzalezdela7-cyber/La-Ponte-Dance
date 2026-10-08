# Security Specification — La Ponte Dance Firestore Rules

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched in `/databases/{database}/documents` are strictly denied for both `read` and `write`.
2. **Ownership & Verified Identity**: Both `ChatSession` (`/sessions/{sessionId}`) and `TrialBooking` (`/trialBookings/{bookingId}`) documents can only be created, read, updated, or deleted by a verified, authenticated user (`request.auth != null && request.auth.token.email_verified == true`) whose `request.auth.uid` matches `ownerId`.
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `isValidId(id)` (`<= 128` chars, alphanumeric/underscore/hyphen regex).
4. **Strict Schema & Anti-Update-Gap**:
   - `/sessions/{sessionId}` calls `isValidChatSession(incoming())` on both `create` and `update`.
   - `/trialBookings/{bookingId}` calls `isValidTrialBooking(incoming())` on both `create` and `update`, enforcing exact key sets (`hasAll` and `hasOnly`), string length bounds (`studentName <= 120`, `studentPhone 6..40`, `ageGroup <= 120`, `activity <= 120`, `preferredDate 8..20`, `preferredTime 4..20`, `calendarEventId 1..200`), status enum (`'confirmed'` or `'cancelled'`), and server timestamps (`request.time`).
5. **Terminal State Locking**:
   - Once a `ChatSession` reaches `status == 'archived'`, no further updates are permitted.
   - Once a `TrialBooking` reaches `status == 'cancelled'`, no further updates are permitted (`existing().status != 'cancelled'`).
6. **Immutable Fields**: `ownerId` and `createdAt` (plus core booking details on cancellation) cannot be modified during `update`.
7. **Secure List Queries**: `allow list` enforces `isVerified() && resource.data.ownerId == request.auth.uid` without any `get()` or `exists()` calls.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/trialBookings/booking_1`.
2. **Unverified Email Spoof**: `auth = { uid: 'user1', token: { email_verified: false } }`, creating `/trialBookings/booking_1`.
3. **Identity Spoofing on Create**: `auth.uid = 'user1'`, `payload.ownerId = 'user2'`.
4. **Shadow Field Injection on Create**: Valid `TrialBooking` payload + `isAdmin: true`.
5. **ID Poisoning**: Document ID containing special characters or length > 128 chars.
6. **Boundary Overflow (`studentName`)**: `studentName` string of 250 characters (`> 120`).
7. **Invalid Enum Value (`status`)**: `status: 'pending'` instead of `'confirmed'` or `'cancelled'`.
8. **Forged Client Timestamp on Create**: `createdAt` set to a past/future timestamp instead of `request.time`.
9. **Immortal Field Mutation on Update**: Attempting to change `ownerId` or `createdAt` during `update`.
10. **Terminal State Mutation**: Attempting to update a `TrialBooking` where `existing().status == 'cancelled'`.
11. **Cross-Tenant PII Read (`get`)**: Authenticated `user2` attempting to `get` a `TrialBooking` (which contains `studentPhone`) owned by `user1`.
12. **Unscoped List Query**: Authenticated `user1` running an unfiltered collection `list` on `/trialBookings` that attempts to read documents where `ownerId != 'user1'`.
