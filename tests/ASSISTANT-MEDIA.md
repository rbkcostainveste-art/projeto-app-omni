# Assistant audio and live camera

Run `node tests/assistant-media-api.cjs` for authenticated endpoint/provider schema checks.
For browser checks, temporarily copy `tests/fixtures/assistant-media-page.tsx` to
`src/app/assistant-test/page.tsx`, start Next on port 3010 and run
`node tests/assistant-media-browser.cjs` with PLAYWRIGHT_MODULE pointing to Playwright.
Remove the temporary route before publishing.

The browser uses synthetic media and a simulated Realtime peer/provider. It checks
recorded audio submission, transcription -> response -> existing personal history,
live frame delivery, transcript persistence, release of devices and reopening.
It makes no paid API calls and does not verify production model/key access.

Production requires OPENAI_API_KEY with access to transcription and Realtime.
Optional OPENAI_REALTIME_MODEL defaults to gpt-realtime. The server keeps the key private
and checks the existing device/employee RPC before connecting or transcribing.
Live audio uses WebRTC; camera images update every three seconds (not full-motion video).
Only the latest camera frame remains in live model context. Each session stops after
five minutes. Text transcripts are appended to the user's existing personal history;
camera frames and original recorded audio are not stored in that text-only history.
