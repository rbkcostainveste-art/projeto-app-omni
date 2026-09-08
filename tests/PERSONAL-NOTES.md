# Personal notes verification

Database: run personal-notes.sql in a rollback transaction. It verifies owner-only
RPC access, employee spoof rejection, idempotent creation/conversion, agenda without
push, reminder claiming/lease, maintenance publication and deletion preserving the
technical record. Storage SELECT was additionally exercised as authenticated with
two employees' synthetic object rows in a rollback transaction: only own media was visible.

Browser: copy fixtures/personal-notes-page.tsx temporarily to src/app/notes-test/page.tsx,
start Next on port 3010, set PLAYWRIGHT_MODULE if needed and run personal-notes-browser.cjs.
Uses a mock backend and storage to check mobile creation, search, prefix, agenda,
notification opt-in, upload, attachment copy on conversion and deletion. Remove the
temporary route before deployment. No employee messages or real records are created.

Notes and the original media remain private. Conversion copies media to the existing
maintenance record storage and uses existing maintenance triggers. Repeated conversion
returns the same record. Deleting a note cancels its reminder and preserves its record.
Push uses the existing subscriptions/VAPID configuration, minute cron and retries.
Reminder text on the lock screen is generic to preserve note privacy.
The deployed worker was invoked with an empty queue: HTTP 200, sent=0.
Phone delivery still depends on browser permission, registration and network/OS policy.
