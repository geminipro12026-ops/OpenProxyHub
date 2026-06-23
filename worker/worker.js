export default {
  async fetch(request, env) {

    const url = new URL(request.url);
    const path = url.pathname;

    // ===== CORS =====
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ===== API KEY CHECK =====
    const apiKey = request.headers.get("X-API-Key");

    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "Unauthorized"
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // ========================
    // HEALTH CHECK
    // ========================
    if (path === "/") {
      return new Response(JSON.stringify({
        status: "OpenProxyHub API Running 🚀 (Secure Mode)"
      }), { headers: corsHeaders });
    }

    // ========================
    // GET USERS
    // ========================
    if (path === "/users") {
      const data = await env.DB.get("users");
      return new Response(data || "[]", { headers: corsHeaders });
    }

    // ========================
    // ADD USER
    // ========================
    if (path === "/addUser") {
      const body = await request.json();

      let users = JSON.parse(await env.DB.get("users") || "[]");

      users.push({
        id: Date.now(),
        ...body
      });

      await env.DB.put("users", JSON.stringify(users));

      return new Response(JSON.stringify({
        success: true
      }), { headers: corsHeaders });
    }

    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders
    });
  }
};
