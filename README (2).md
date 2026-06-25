# 🚀 OpenProxyHub v1.1 — Setup Guide (Phone-only, no computer needed)

**OpenProxyHub = UI (GitHub Pages) + Brain (Cloudflare Worker) + DB (Cloudflare KV) + Panel connectors + Access/License system.**

A professional hub where you (and the buyers you approve) can connect **unlimited panels & servers** and
manage everything from inside the app — without ever opening the original panel.

## Features in v1.1
- 🔐 **Access/License system** — buyers register by email, you issue a **unique code**, code is **locked to one device**
- 👥 **Buyer list** (Licenses tab): see everyone, their device-lock status, last login; **approve / re-issue / reset device / revoke / delete**
- 📧 Optional **email to you** when someone requests access (via Resend)
- 🗂 Local users + connect **unlimited panels** (Nahan driver; extensible)
- 🌐 **All panels** view · full user control: Add/Edit/Delete/Renew/Pause/Reset/Copy sub link
- 📊 Stats per panel · per-buyer **data isolation** (each buyer sees only their own panels/users)

### Honest limits
- Play Store / App Store publishing + in-app payment (Google/Apple Billing) need a **native app + paid dev accounts** — not buildable in this web form.
- "100% uncrackable / no-decompile" is **impossible**. We do the right thing: keys & logic stay on the Worker.
- **Device lock on web** is best-effort (per-browser id). It becomes much stronger inside a native Android app.

---

## STEP 1 — GitHub (private)
github.com → New repository → `openproxyhub` → **Private** → upload all files → Commit.

## STEP 2 — GitHub Pages
Repo → Settings → Pages → Branch `main`, folder `/dashboard` → Save → get `https://YOURNAME.github.io/openproxyhub/`.

## STEP 3 — Deploy the Worker
dash.cloudflare.com → Workers & Pages → Create Worker → name `openproxyhub` → Deploy →
Edit code → paste all of `worker.js` → Deploy.

## STEP 4 — KV database
Workers & Pages → KV → Create namespace `USERS_KV`. Then Worker → Settings → Variables →
**KV Namespace Bindings** → variable `USERS` → `USERS_KV` → Save.

## STEP 5 — Secrets
Worker → Settings → Variables → Environment Variables:
- `API_KEY` = a long random password (your owner key) — **Encrypt** → Save.
- (optional, for email alerts) `RESEND_API_KEY` = from resend.com, and `OWNER_EMAIL` = your email.

## STEP 6 — (optional) bake the URL for buyers
In `dashboard/app.js`, set `const HUB_URL = "https://openproxyhub.YOURNAME.workers.dev";`
so buyers don't have to type the URL. Commit. (Leave "" to show a URL field instead.)

---

## How the access system works
1. **Buyer** opens the app → “I have a code” tab → enters **email** → **Request access**.
   (A request is saved; if you set Resend, you also get an email.)
2. **You (owner)** log in via the **Owner** tab (URL + `API_KEY`) → **Licenses** tab → find the request →
   **Approve** → type or 🎲 generate a **unique code**. If `RESEND_API_KEY` is set, the code is
   **emailed automatically to the buyer**; otherwise copy it and send it yourself.
3. **Buyer** enters email + code → **Log in**. The code **locks to their device** on first login.
4. If they try the same code on another phone/PC → **error: locked to another device**.
5. You can **Reset device** (let them move once), **Revoke**, or **Delete** any buyer anytime.

## Connect your panel (Nahan)
Panels tab → **＋ Connect panel**: Name, Driver = `Nahan / edgetunnel`,
Base URL (e.g. `https://fragrant-haze-f80c.geminipro12026.workers.dev`), API route (`sync`), Master key (panel admin password).
Save → **📡 Test** → 🟢. Each buyer connects their own panels the same way.

## Worker endpoints
- Public: `GET /ping`, `POST /auth/register {email,deviceId}`, `POST /auth/login {email,code,deviceId}`
- Auth (admin `x-api-key` OR buyer `x-session`): `GET /auth/me`, users + panels CRUD, `/panel/*`
- Admin only: `GET /licenses`, `POST /approveLicense|/revokeLicense|/resetDevice|/deleteLicense`

## Next (optional): Android APK
Use **Codemagic** (cloud) with a Flutter/WebView wrapper pointing to your GitHub Pages URL. The app
already works fully in the mobile browser; the wrapper makes the device lock stronger and lets you
publish an APK.
