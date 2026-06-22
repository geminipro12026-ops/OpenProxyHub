export default {
  async fetch(request, env) {

    const url = new URL(request.url);
    const path = url.pathname;

    // CORS (مهم برای GitHub Pages)
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // ===== GET USERS =====
    if (path === "/users") {
      const data = await env.DB.get("users");
      return new Response(data || "[]", { headers });
    }

    // ===== ADD USER =====
    if (path === "/addUser") {
      const body = await request.json();

      let users = JSON.parse(await env.DB.get("users") || "[]");
      users.push(body);

      await env.DB.put("users", JSON.stringify(users));

      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    // ===== DEFAULT =====
    return new Response(JSON.stringify({
      status: "OpenProxyHub API Running 🚀"
    }), { headers });
  }
};
