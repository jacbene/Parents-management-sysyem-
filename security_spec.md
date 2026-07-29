# Security Specification & Verification (Firestore Security Rules)

## 1. Data Invariants
1. **Authentication Requirement**: All write operations across all collections require an authenticated user (`request.auth != null`).
2. **Super Admin Privilege**: Super admins (e.g. `jacquesbene301@gmail.com` or users listed in `/super_admins/{email}`) have administrative access to manage system resources, establishments, and logs.
3. **Establishment Integrity**: School establishments can be read by any authenticated user for onboarding/portal access, but writes are restricted to authenticated users creating or modifying their respective school or super admins.
4. **Student Data Isolation**: Student profiles, grades, attendance records, homeworks, appointments, messages, invoices, and lessons must belong to or be linked to a valid parent/user or school ID (`parentId` or student owner), preventing cross-tenant spoofing.
5. **Invoice & Financial Record Validation**: Invoices, tuition records, and APEE financial transactions cannot be tampered with by unauthorized users.
6. **Audit & Support Log Integrity**: Logs (`logs_auth`) and support tickets (`help_requests`, `roadmap_suggestions`) can be created by authenticated users, but modification or deletion is restricted to super admins.
7. **System & Session Controls**: Active sessions and deleted school records (`system/deleted_schools`) are strictly managed by active authenticated users or super admins.

## 2. The "Dirty Dozen" Threat Payloads
Below are 12 malicious or invalid payloads designed to break identity, schema integrity, or state boundaries:

1. **Unauthenticated Read/Write Attack**: An unauthenticated user attempts to read or write `/students/student_123`.
   - *Expected Outcome*: PERMISSION_DENIED (Must require `request.auth != null`).

2. **Cross-Tenant Student Injection**: User `user_A` attempts to create a student profile with `parentId: "user_B"`.
   - *Expected Outcome*: PERMISSION_DENIED (Must enforce `parentId == request.auth.uid` or admin privilege).

3. **Super Admin Impersonation**: Non-admin user attempts to insert themselves into `/super_admins/hacker@evil.com`.
   - *Expected Outcome*: PERMISSION_DENIED (Must require existing super admin or specific super admin email).

4. **Malformed Document ID Injection**: Attacker attempts to create a document with a 2KB junk character path ID.
   - *Expected Outcome*: PERMISSION_DENIED (Must enforce `isValidId()`).

5. **Ghost Field / Shadow Key Injection**: Attacker attempts to update a student document adding `{ "isSuperAdmin": true }`.
   - *Expected Outcome*: PERMISSION_DENIED (Must validate fields or enforce strict schema matching).

6. **Invoice Fee Tampering**: Non-admin user attempts to overwrite another school's fee settings document `/invoices/school_X_settings` to reduce fees to `0`.
   - *Expected Outcome*: PERMISSION_DENIED.

7. **Auth Log Tampering**: User attempts to delete or modify an authentication audit log entry in `/logs_auth/log_999`.
   - *Expected Outcome*: PERMISSION_DENIED (Logs are append-only for users, editable/deletable only by super admin).

8. **System Deleted Schools Wipe**: User attempts to wipe the `/system/deleted_schools` tracking document.
   - *Expected Outcome*: PERMISSION_DENIED.

9. **Grade Manipulation**: User `user_A` attempts to update a grade document belonging to `user_B`'s student.
   - *Expected Outcome*: PERMISSION_DENIED.

10. **Arbitrary Unbounded Payload**: Attacker attempts to upload a 500KB text string into a student's `name` property.
    - *Expected Outcome*: PERMISSION_DENIED (Must enforce string size limit e.g. `<= 500` characters).

11. **Client-Forged Server Timestamp**: Attacker attempts to forge historical `createdAt` dates.
    - *Expected Outcome*: PERMISSION_DENIED (Must validate timestamp constraints or server timestamp).

12. **Unauthenticated Support Ticket Wipe**: Attacker attempts to delete support requests in `/help_requests`.
    - *Expected Outcome*: PERMISSION_DENIED.
