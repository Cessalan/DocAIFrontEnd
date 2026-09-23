# Admin workspace rollout

Owner: fatsyram@gmail.com (verified Firebase Auth email required).
The owner is recognized by the backend, not a client-editable profile field.
First /admin/workspace/me access creates the protected owner record. The owner
can grant/revoke existing accounts; admins cannot manage roles or remove owner.
Every backend request verifies a Firebase token with revocation checking and
reads the current role. Role, email draft and audit collections are server-only.

## Implemented
- Production /admin route guard and shared navigation for existing dashboards.
- Paginated users (100 per page), stored generation usage, plan and last login.
- Upcoming exams from users/{uid}/exams, with onboarding-date fallback.
- Individual plain-text email preview, explicit send, actor history, suppression,
  daily caps and transaction-protected duplicate prevention.
- No real email was sent in tests. Sent means provider acceptance, not delivery.
- Email preview expires after one hour; ambiguous sends are not auto-retried.

## Release blocker
The prior Docker packaging copied .env and Firebase credentials into the image.
Automatic approval review rejected uploading that sensitive build context.
Docker exclusions now omit those files. Firebase falls back to Application
Default Credentials when the local credential file is absent.
Before deployment, move required server secrets to Secret Manager, attach them
to Cloud Run, and verify service-identity access to Firestore, Auth and Storage.
Do NOT deploy the new secret-free backend before its runtime configuration is ready.

## Rollout order after runtime configuration is ready
1. Build secret-free backend; deploy a no-traffic revision and verify startup.
2. Verify verified-owner login and denial of ordinary/revoked accounts.
3. Publish Firestore rules, then backend traffic and frontend hosting together.
4. Owner signs in at /admin, grants a test admin, then revokes it and checks denial.
5. Test a dry-run email preview/send. Never enable real sending just to test UI.

The rules compiled successfully with firebase deploy --only firestore:rules
--dry-run. The old deployed rules were saved at deployed-firestore-before-admin.rules.
The rules protect users, chats, feedback, funnels, and admin/email records.
Unrelated collections retain their previous rules; this is not a full database audit.

## Current bounds
Search filters loaded user pages. Exam reports scan up to 2,000 exam records and
5,000 user records, show truncation warnings, and use UTC calendar dates.
This version sends to individuals, not bulk audiences. Inbox delivery/open
tracking and automatic campaigns are not part of the new composer.
