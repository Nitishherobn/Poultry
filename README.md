# Poultry

Daymark is a study planner with a Python local API for Canvas calendar imports and Gemini study responses. Start the server and open the localhost URL; preferences and tasks are saved in that browser's local storage.

## Run locally

1. Install the packages with `py -m pip install -r requirements.txt`.
2. Run `py -m uvicorn server:app --host 127.0.0.1 --port 8000` from the project directory.
3. Open `http://127.0.0.1:8000` and select **Connect tools** in the top bar for the guided Canvas and Gemini setup.

The server only binds to the local computer. Do not expose it to the internet as-is.

## Show it on a phone

For a same-Wi-Fi showcase, run `py phone_preview.py` on the computer and open `http://<computer-wi-fi-ip>:8765` on the phone. Find the computer's Wi-Fi IPv4 address with `ipconfig`. Keep both devices on the same trusted network; if the network blocks device-to-device traffic, use a personal hotspot. Allow Python through Windows Firewall only on a private network if prompted.

This preview server serves only the frontend files and does not expose `.env`, the Gemini backend, or Canvas data. Gemini and Canvas are intentionally unavailable in this read-only showcase. Android Chrome can use **Add to Home screen**; on iPhone, open the page in Safari and use **Share > Add to Home Screen**. This creates a shortcut, not a native/offline app package. User data is stored locally in the phone's browser.

To import Canvas assignments in the phone preview, open the Canvas Calendar Feed link on your phone and save/download its `.ics` calendar file. In Daymark, go to **Schedule > Import Canvas .ics** and select that file from Files or Downloads. The preview parses it on-device and stores imported assignments in local browser storage; it never uploads the private feed URL.

## Connect integrations

- **Canvas:** Follow the in-app guide to open Canvas Calendar, copy a fresh Calendar Feed URL, and paste it into the Canvas field. Treat the full URL like a password; revoke/regenerate the previously shared feed URL. Use **Sync Canvas** in the schedule; matching upcoming assignments are imported and deduplicated by Canvas event ID.
- **Gemini:** Follow the in-app Google AI Studio link, create an API key, and paste it into the masked Gemini field. The default model is `gemini-2.5-flash`. Questions and the current task titles are sent to Google Gemini by the local backend.

The app sends credentials only to the localhost backend, which writes them to `.env`; it does not return secret values or put them in browser storage. The `.env` file is ignored by Git and is not served over HTTP. The backend reports whether either integration is configured without revealing the secret.

## What works

- First-run interest and subject survey, followed by Locked In or Casual mode.
- A task queue that keeps all deadlines within roughly one day visible, then favors interest-matched work. Remaining work stays collapsed.
- Personal target dates brought forward from actual due dates. The original due date is kept separate and never changed.
- Start, pause, reset, and 25/5 or 50/10 Pomodoro sessions, with breaks switching the distraction preview back to locked.
- An observation-based 1–10 focus rating from completed focus sessions, due-task completion, and time away from the active tab; demo buddy matching starts automatically when the observation window ends.
- A partner-chat prototype that unlocks after matching, saves the conversation locally, and labels generated peer replies as simulated.
- A People page with profile search and daily, weekly, monthly, and all-time leaderboards, plus per-field profile privacy and a discoverability toggle.
- Locked In points and streaks, temporary unlock duration settings, and a daily unlock gated on finishing every task.
- Gemini-backed study questions through the local server when `GEMINI_API_KEY` is configured.

## Prototype boundaries

This is a local prototype, not an installed mobile app. Its rating is a transparent deterministic formula, not a trained AI model: 40% completed focus sessions, 30% eligible tasks finished, and 30% foreground time during focus sessions. Browser visibility is only a proxy for distraction and cannot observe other apps or devices. Canvas ICS imports and Gemini requests run through the local API; keep `.env` private. The server is bound to localhost and is not production-hardened. Profiles and leaderboard rows are local/demo data; locked-in hours are tracked locally by day. Privacy toggles control what this browser shows, but do not sync to or hide information from a real shared service. Demo buddy matching uses sample profiles; partner-chat messages are stored in local storage and sample replies are scripted. Neither reaches another user. Real peer matching, account-backed profiles, real-time message delivery, and shared privacy enforcement need a backend and explicit consent. Google sign-in, notifications, and operating-system app blocking are not connected. Real distraction blocking requires a supported native app and explicit operating-system permissions.

The observation window is configured by `OBSERVATION_DAYS` near the top of `app.js`. Set it to `0` and reload to skip the wait and immediately preview the calculated rating and demo match. Restore it to `1` for a one-day window or set it to `2` for a two-day window.

All demo data and preferences are stored locally in the browser. Use the browser's site-data controls to clear local storage and replay onboarding.
