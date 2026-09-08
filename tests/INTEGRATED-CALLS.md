# Integrated chat calls

`integrated-calls.sql` runs in a rolled-back transaction. It checks membership,
incoming calls, accepting/declining, one device per employee, recipient-only
signals, signal retry, six-person capacity, expiration and retained call history.
It requires seven existing active device identities. Test messages are rolled back.

For browser verification, temporarily copy `fixtures/calls-page.tsx` to
`src/app/calls-test/page.tsx`, run the Next dev server on port 3010, then run
`node tests/calls-browser.cjs`. Set `PLAYWRIGHT_MODULE` to an installed Playwright
module path if it is not available as a local dependency. The script uses Edge,
synthetic camera/microphone and a mocked RPC service; it does not contact employees.
Remove the temporary app route before building or publishing.

Verified scenarios: direct audio/video send, cancel, three-way WebRTC video,
incoming/accept, actual received audio packets, mute, camera toggle, screen sharing
in a video call, no camera controls in audio calls, recording notice and camera switch, media track cleanup, and denied permission. Calls stay in
the same browser page. The caller also exercises the answering side of negotiation.

## Operational boundaries

- Mesh WebRTC, at most six participants. No external meeting service or account.
- STUN discovery configured; no TURN relay is provisioned. Some networks cannot
  connect directly. Cross-network/mobile device reliability requires field testing
  and may require a separately provisioned relay.
- Incoming call UI runs while the web app is visible. Existing message push carries
  the start notice; this is not a native background calling service.
- Call metadata and start/end messages remain in the conversation. Video calls can be recorded locally in five-minute segments (45 MB stopping threshold),
  with a peer notice, download and optional idempotent upload to the original chat.
  Screen capture requires browser getDisplayMedia support; unsupported phones show an explanation. SDP/ICE negotiation is deleted on end or after five minutes.
- Heartbeats are written every ten seconds; stale participants expire after 45
  seconds. Unanswered calls time out after 60 seconds. Minute cron is the fallback.
- Message capture stops at two minutes or the existing media size limit. The send
  control sends immediately; failed uploads use the chat's idempotent retry flow.
- New tables intentionally deny direct client access; the authenticated RPC checks
  active device identity, conversation membership and the caller's session.
