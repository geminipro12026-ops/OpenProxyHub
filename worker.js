/**
 * OpenProxyHub - Cloudflare Worker (API Brain)  v1.1
 *
 * Layers:
 *  A) LICENSE / ACCESS system  -> register (email) + owner-issued unique code + device lock + buyer list
 *  B) LOCAL users (KV)         -> per-owner records
 *  C) PANEL connectors         -> control real remote panels (Nahan / edgetunnel forks)
 *
 * Bindings (Cloudflare dashboard):
 *   - KV Namespace binding:  USERS
 *   - Env Secret:            API_KEY        (owner/admin master secret)
 *   - (optional) RESEND_API_KEY + OWNER_EMAIL  -> email you when someone requests access
 *
 * Access:
 *   - Owner/admin: header  x-api-key: <API_KEY>             (full access, manage licenses)
 *   - Buyer:       header  x-session: <token from /auth/login>  (scoped to their own data)
 *
 * Public endpoints (no auth):  GET /ping, POST /auth/register, POST /auth/login
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-session",
};
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const GB = 1073741824;
const REQ_PER_GB = 6000;
const lc = (s) => String(s || "").trim().toLowerCase();

/* ============ crypto / tokens ============ */
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
async function makeToken(secret, email, deviceId) {
  const payload = b64u(JSON.stringify({ email: lc(email), deviceId, t: Date.now() }));
  const sig = await hmacHex(secret, payload);
  return payload + "." + sig;
}
async function readToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if ((await hmacHex(secret, payload)) !== sig) return null;
  try { return JSON.parse(unb64u(payload)); } catch { return null; }
}

/* ============ KV helpers ============ */
async function kvList(env, prefix) {
  const out = []; let cursor;
  do {
    const res = await env.USERS.list({ prefix, cursor });
    for (const k of res.keys) { const v = await env.USERS.get(k.name); if (v) out.push(JSON.parse(v)); }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return out;
}

/* ============ LICENSES ============ */
const licKey = (email) => "lic:" + lc(email);
async function getLicense(env, email) { const r = await env.USERS.get(licKey(email)); return r ? JSON.parse(r) : null; }
async function putLicense(env, l) { await env.USERS.put(licKey(l.email), JSON.stringify(l)); return l; }
async function listLicenses(env) {
  const l = await kvList(env, "lic:");
  l.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return l;
}
const licPublic = (l) => ({ email: l.email, status: l.status, deviceBound: !!l.deviceId, note: l.note || "",
  createdAt: l.createdAt, approvedAt: l.approvedAt || null, lastLoginAt: l.lastLoginAt || null });

async function sendEmail(env, to, subject, text) {
  if (!env.RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "OpenProxyHub <onboarding@resend.dev>", to, subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (e) { return false; }
}
async function notifyOwner(env, subject, text) {
  if (!env.OWNER_EMAIL) return;
  await sendEmail(env, env.OWNER_EMAIL, subject, text);
}

/* ============ LOCAL USERS ============ */
function buildUser(input, existing = {}, owner = "admin") {
  const total = Number(input.totalQuotaGB ?? existing.totalQuotaGB ?? 0);
  const used = Number(input.usedQuotaGB ?? existing.usedQuotaGB ?? 0);
  return {
    id: existing.id || uuid(),
    owner: existing.owner || owner,
    username: String(input.username ?? existing.username ?? "").trim(),
    panelType: input.panelType ?? existing.panelType ?? "BPB",
    serverLocation: input.serverLocation ?? existing.serverLocation ?? "",
    status: input.status ?? existing.status ?? "Active",
    totalQuotaGB: total, usedQuotaGB: used, remainingQuotaGB: Math.max(0, total - used),
    dailyQuotaGB: Number(input.dailyQuotaGB ?? existing.dailyQuotaGB ?? 0),
    expireAt: input.expireAt ?? existing.expireAt ?? null,
    notes: input.notes ?? existing.notes ?? "",
    createdAt: existing.createdAt || now(), updatedAt: now(),
  };
}
async function listUsers(env, scope) {
  let u = await kvList(env, "user:");
  if (!scope.admin) u = u.filter((x) => x.owner === scope.email);
  u.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return u;
}

/* ============ PANEL REGISTRY ============ */
function buildPanel(input, existing = {}, owner = "admin") {
  return {
    id: existing.id || uuid(),
    owner: existing.owner || owner,
    name: String(input.name ?? existing.name ?? "").trim(),
    mode: input.mode ?? existing.mode ?? "Cloudflare",
    driver: input.driver ?? existing.driver ?? "nahan",
    baseUrl: String(input.baseUrl ?? existing.baseUrl ?? "").replace(/\/+$/, ""),
    apiRoute: String(input.apiRoute ?? existing.apiRoute ?? "sync").replace(/^\/+|\/+$/g, ""),
    masterKey: input.masterKey && input.masterKey !== "********" ? input.masterKey : (existing.masterKey || ""),
    createdAt: existing.createdAt || now(), updatedAt: now(),
  };
}
const stripKey = (p) => ({ ...p, masterKey: undefined, hasKey: !!p.masterKey });
async function listPanels(env, scope) {
  let p = await kvList(env, "panel:");
  if (!scope.admin) p = p.filter((x) => x.owner === scope.email);
  p.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return p;
}
async function getPanel(env, id) { const r = await env.USERS.get("panel:" + id); return r ? JSON.parse(r) : null; }

/* ============ NAHAN DRIVER ============ */
const nahanBase = (p) => `${p.baseUrl}/${p.apiRoute}`;
async function nahanFetch(panel, method, path, body) {
  const url = nahanBase(panel) + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(panel.masterKey);
  const res = await fetch(url, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify({ ...body, key: panel.masterKey }) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { success: false, error: text.slice(0, 200) }; }
  return { httpOk: res.ok, data };
}
function normalizeNahanUser(u, panel) {
  const totalGB = u.limitTotalReq ? u.limitTotalReq / REQ_PER_GB : (u.usage?.limit ? u.usage.limit / GB : 0);
  const usedGB = u.usage?.total ? u.usage.total / GB : 0;
  const dailyGB = u.limitDailyReq ? u.limitDailyReq / REQ_PER_GB : 0;
  let status = "Active";
  if (u.status === "expired") status = "Expired";
  else if (u.status === "paused" || u.status === "auto-disabled" || u.isPaused) status = "Disabled";
  return {
    id: u.id, username: u.name, panelType: panel.name, serverLocation: u.proxyIpGeo?.country || "",
    status, totalQuotaGB: Math.round(totalGB * 100) / 100, usedQuotaGB: Math.round(usedGB * 100) / 100,
    remainingQuotaGB: Math.max(0, Math.round((totalGB - usedGB) * 100) / 100),
    dailyQuotaGB: Math.round(dailyGB * 100) / 100,
    expireAt: u.expiryMs ? new Date(u.expiryMs).toISOString().slice(0, 10) : null,
    notes: u.notes || "",
    subscriptionUrl: u.subscriptionUrl || `${panel.baseUrl}/${panel.apiRoute}?sub=${encodeURIComponent(u.name || "")}`,
  };
}
const daysUntil = (d) => (!d ? 0 : Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)));

/* ============ scope resolver ============ */
async function getScope(request, env) {
  if (env.API_KEY && request.headers.get("x-api-key") === env.API_KEY) return { admin: true };
  const tok = request.headers.get("x-session");
  if (tok) {
    const p = await readToken(env.API_KEY, tok);
    if (p && p.email) {
      const lic = await getLicense(env, p.email);
      if (lic && lic.status === "active" && lic.deviceId && lic.deviceId === p.deviceId)
        return { admin: false, email: p.email };
    }
  }
  return null;
}

/* =========================================================
   ROUTER
   ========================================================= */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;
    const body = method === "POST" ? await request.json().catch(() => ({})) : {};

    try {
      /* -------- PUBLIC -------- */
      if (path === "/ping") return json({ ok: true, service: "OpenProxyHub", version: "1.1" });

      if (method === "POST" && path === "/auth/register") {
        const email = lc(body.email);
        if (!email || !email.includes("@")) return json({ ok: false, error: "valid email required" }, 400);
        let lic = await getLicense(env, email);
        if (!lic) lic = { email, code: "", deviceId: null, status: "pending", note: body.note || "", createdAt: now() };
        lic.requestedAt = now();
        lic.lastDeviceSeen = body.deviceId || lic.lastDeviceSeen || null;
        await putLicense(env, lic);
        await notifyOwner(env, "OpenProxyHub: new access request",
          `New access request.\nEmail: ${email}\nDevice: ${body.deviceId || "?"}\nTime: ${now()}\n\nApprove it in your dashboard (Licenses tab) and give them a code.`);
        return json({ ok: true, status: lic.status });
      }

      if (method === "POST" && path === "/auth/login") {
        const email = lc(body.email), code = String(body.code || ""), deviceId = String(body.deviceId || "");
        if (!email || !code || !deviceId) return json({ ok: false, error: "email, code and deviceId required" }, 400);
        const lic = await getLicense(env, email);
        if (!lic) return json({ ok: false, error: "No request found for this email. Register first." }, 404);
        if (lic.status === "revoked") return json({ ok: false, error: "This license has been revoked." }, 403);
        if (lic.status !== "active" || !lic.code) return json({ ok: false, error: "Not approved yet. Wait for your code." }, 403);
        if (code !== lic.code) return json({ ok: false, error: "Invalid code." }, 401);
        if (!lic.deviceId) { lic.deviceId = deviceId; }            // bind on first login
        else if (lic.deviceId !== deviceId)
          return json({ ok: false, error: "This code is locked to another device." }, 403);
        lic.lastLoginAt = now();
        await putLicense(env, lic);
        const token = await makeToken(env.API_KEY, email, deviceId);
        return json({ ok: true, token, email });
      }

      /* -------- AUTH required (admin OR buyer) -------- */
      const scope = await getScope(request, env);
      if (!scope) return json({ ok: false, error: "Unauthorized" }, 401);

      if (path === "/auth/me") return json({ ok: true, scope: scope.admin ? "admin" : "user", email: scope.email || null });

      /* -------- LICENSE management (admin only) -------- */
      const LIC_PATHS = ["/licenses", "/approveLicense", "/revokeLicense", "/resetDevice", "/deleteLicense"];
      if (LIC_PATHS.includes(path)) {
        if (!scope.admin) return json({ ok: false, error: "admin only" }, 403);
        if (method === "GET" && path === "/licenses")
          return json({ ok: true, licenses: await listLicenses(env) });
        if (method === "POST" && path === "/approveLicense") {
          const email = lc(body.email);
          let lic = await getLicense(env, email) || { email, deviceId: null, createdAt: now() };
          lic.code = String(body.code || "").trim() || lic.code;
          if (!lic.code) return json({ ok: false, error: "code required" }, 400);
          lic.status = "active"; lic.approvedAt = now();
          if (body.note !== undefined) lic.note = body.note;
          await putLicense(env, lic);
          await notifyOwner(env, "OpenProxyHub: license approved", `Approved ${email}. Code issued.`);
          const emailed = await sendEmail(env, email, "Your OpenProxyHub access code",
            `Hello,\n\nYour access has been approved. 🎉\n\nLog in to OpenProxyHub with:\n  Email: ${email}\n  Access code: ${lic.code}\n\nImportant: this code locks to the FIRST device you log in on. It will not work on a second device.\n\nEnjoy!`);
          return json({ ok: true, license: lic, emailed });
        }
        if (method === "POST" && path === "/revokeLicense") {
          const lic = await getLicense(env, body.email);
          if (!lic) return json({ ok: false, error: "not found" }, 404);
          lic.status = "revoked"; await putLicense(env, lic);
          return json({ ok: true, license: licPublic(lic) });
        }
        if (method === "POST" && path === "/resetDevice") {
          const lic = await getLicense(env, body.email);
          if (!lic) return json({ ok: false, error: "not found" }, 404);
          lic.deviceId = null; if (lic.status === "revoked") lic.status = "active";
          await putLicense(env, lic);
          return json({ ok: true, license: licPublic(lic) });
        }
        if (method === "POST" && path === "/deleteLicense") {
          await env.USERS.delete(licKey(body.email));
          return json({ ok: true, deleted: lc(body.email) });
        }
      }

      const owner = scope.admin ? "admin" : scope.email;

      /* -------- LOCAL users -------- */
      if (method === "GET" && path === "/status") {
        const u = await listUsers(env, scope);
        return json({ ok: true, totalUsers: u.length,
          active: u.filter((x) => x.status === "Active").length,
          expired: u.filter((x) => x.status === "Expired").length,
          disabled: u.filter((x) => x.status === "Disabled").length,
          totalUsedGB: Math.round(u.reduce((s, x) => s + (x.usedQuotaGB || 0), 0) * 100) / 100 });
      }
      if (method === "GET" && path === "/users") return json({ ok: true, users: await listUsers(env, scope) });
      if (method === "POST" && path === "/addUser") {
        if (!body.username) return json({ ok: false, error: "username required" }, 400);
        const u = buildUser(body, {}, owner);
        await env.USERS.put("user:" + u.id, JSON.stringify(u));
        return json({ ok: true, user: u });
      }
      if (method === "POST" && path === "/updateUser") {
        const raw = await env.USERS.get("user:" + body.id);
        if (!raw) return json({ ok: false, error: "user not found" }, 404);
        const ex = JSON.parse(raw);
        if (!scope.admin && ex.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403);
        const u = buildUser(body, ex, owner);
        await env.USERS.put("user:" + u.id, JSON.stringify(u));
        return json({ ok: true, user: u });
      }
      if (method === "POST" && path === "/deleteUser") {
        const raw = await env.USERS.get("user:" + body.id);
        if (raw) { const ex = JSON.parse(raw); if (!scope.admin && ex.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403); }
        await env.USERS.delete("user:" + body.id);
        return json({ ok: true, deleted: body.id });
      }

      /* -------- PANEL registry -------- */
      if (method === "GET" && path === "/panels")
        return json({ ok: true, panels: (await listPanels(env, scope)).map(stripKey) });
      if (method === "POST" && path === "/addPanel") {
        if (!body.name) return json({ ok: false, error: "name required" }, 400);
        const p = buildPanel(body, {}, owner);
        await env.USERS.put("panel:" + p.id, JSON.stringify(p));
        return json({ ok: true, panel: stripKey(p) });
      }
      if (method === "POST" && path === "/updatePanel") {
        const ex = await getPanel(env, body.id);
        if (!ex) return json({ ok: false, error: "panel not found" }, 404);
        if (!scope.admin && ex.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403);
        const p = buildPanel(body, ex, owner);
        await env.USERS.put("panel:" + p.id, JSON.stringify(p));
        return json({ ok: true, panel: stripKey(p) });
      }
      if (method === "POST" && path === "/deletePanel") {
        const ex = await getPanel(env, body.id);
        if (ex && !scope.admin && ex.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403);
        await env.USERS.delete("panel:" + body.id);
        return json({ ok: true, deleted: body.id });
      }
      if (method === "POST" && path === "/testPanel") {
        const p = await getPanel(env, body.id);
        if (!p) return json({ ok: false, error: "panel not found" }, 404);
        if (!scope.admin && p.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403);
        const r = await nahanFetch(p, "POST", "/api/auth", {});
        return json({ ok: !!r.data?.success, result: r.data });
      }

      /* -------- REMOTE panel users -------- */
      if (path.startsWith("/panel/")) {
        const panelId = body.panelId || url.searchParams.get("panelId");
        const p = await getPanel(env, panelId);
        if (!p) return json({ ok: false, error: "panel not found" }, 404);
        if (!scope.admin && p.owner !== scope.email) return json({ ok: false, error: "forbidden" }, 403);
        if (p.driver !== "nahan") return json({ ok: false, error: "unsupported driver: " + p.driver }, 400);
        if (!p.masterKey) return json({ ok: false, error: "panel has no master key" }, 400);

        if (method === "GET" && path === "/panel/users") {
          const r = await nahanFetch(p, "GET", "/api/users");
          if (!r.data?.success) return json({ ok: false, error: r.data?.error || "panel error" }, 502);
          return json({ ok: true, users: (r.data.users || []).map((u) => normalizeNahanUser(u, p)) });
        }
        if (method === "GET" && path === "/panel/stats") {
          const r = await nahanFetch(p, "GET", "/api/stats");
          return json({ ok: !!r.data?.success, stats: r.data });
        }
        if (method === "POST" && path === "/panel/addUser") {
          if (!body.username) return json({ ok: false, error: "username required" }, 400);
          const payload = { name: body.username,
            trafficLimit: Number(body.totalQuotaGB || 0) || undefined,
            dailyLimit: Number(body.dailyQuotaGB || 0) || undefined,
            expiryDays: body.expireAt ? daysUntil(body.expireAt) : undefined, notes: body.notes || "" };
          const r = await nahanFetch(p, "POST", "/api/users", payload);
          return json({ ok: !!r.data?.success, result: r.data }, r.data?.success ? 200 : 502);
        }
        if (method === "POST" && path === "/panel/updateUser") {
          const f = {};
          if (body.username !== undefined) f.name = body.username;
          if (body.totalQuotaGB !== undefined) f.trafficLimit = Number(body.totalQuotaGB) || 0;
          if (body.dailyQuotaGB !== undefined) f.dailyLimit = Number(body.dailyQuotaGB) || 0;
          if (body.expireAt !== undefined) f.expiryDays = body.expireAt ? daysUntil(body.expireAt) : 0;
          if (body.notes !== undefined) f.notes = body.notes;
          if (body.status !== undefined) f.status = body.status === "Disabled" ? "paused" : "active";
          const r = await nahanFetch(p, "PUT", "/api/users?id=" + encodeURIComponent(body.id), f);
          return json({ ok: !!r.data?.success, result: r.data }, r.data?.success ? 200 : 502);
        }
        if (method === "POST" && path === "/panel/deleteUser") {
          const r = await nahanFetch(p, "DELETE", "/api/users?id=" + encodeURIComponent(body.id));
          return json({ ok: !!r.data?.success, result: r.data }, r.data?.success ? 200 : 502);
        }
        if (method === "POST" && path === "/panel/toggleUser") {
          const r = await nahanFetch(p, "POST", "/api/users?id=" + encodeURIComponent(body.id) + "&action=toggle");
          return json({ ok: !!r.data?.success, result: r.data }, r.data?.success ? 200 : 502);
        }
        if (method === "POST" && path === "/panel/resetUser") {
          const r = await nahanFetch(p, "POST", "/api/users?id=" + encodeURIComponent(body.id) + "&action=reset");
          return json({ ok: !!r.data?.success, result: r.data }, r.data?.success ? 200 : 502);
        }
        if (method === "POST" && path === "/panel/renewUser") {
          const cur = await nahanFetch(p, "GET", "/api/users?id=" + encodeURIComponent(body.id));
          const u = cur.data?.user;
          if (!u) return json({ ok: false, error: "user not found on panel" }, 404);
          const remaining = u.expiryMs && u.expiryMs > Date.now() ? Math.ceil((u.expiryMs - Date.now()) / 86400000) : 0;
          const expiryDays = remaining + Math.max(1, Number(body.addDays || 0));
          const r = await nahanFetch(p, "PUT", "/api/users?id=" + encodeURIComponent(body.id), { expiryDays, status: "active" });
          if (r.data?.success && body.resetUsed)
            await nahanFetch(p, "POST", "/api/users?id=" + encodeURIComponent(body.id) + "&action=reset");
          return json({ ok: !!r.data?.success, result: r.data, newExpiryDays: expiryDays }, r.data?.success ? 200 : 502);
        }
      }

      return json({ ok: false, error: "Not found", path }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  },
};
