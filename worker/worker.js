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

    // ===== HEALTH CHECK =====
    if (path === "/") {
      return new Response(JSON.stringify({
        status: "OpenProxyHub API Running 🚀"
      }), {
        headers: corsHeaders
      });
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
    // GET USERS
    // ========================
    if (path === "/users") {

      const data = await env.DB.get("users");

      return new Response(data || "[]", {
        headers: corsHeaders
      });

    }

    // ========================
    // ADD USER
    // ========================
    if (path === "/addUser") {

      const body = await request.json();

      let users = JSON.parse(await env.DB.get("users") || "[]");

      // Username Required
      if (!body.username || body.username.trim() === "") {

        return new Response(JSON.stringify({
          success: false,
          error: "Username is required"
        }), {
          status: 400,
          headers: corsHeaders
        });

      }

      // Username Duplicate
      const exists = users.find(
        u => u.username.toLowerCase() === body.username.toLowerCase()
      );

      if (exists) {

        return new Response(JSON.stringify({
          success: false,
          error: "Username already exists"
        }), {
          status: 400,
          headers: corsHeaders
        });

      }

      users.push({

        id: crypto.randomUUID(),

        username: body.username,

        panel: body.panel || "BPB",

        server: body.server || "Germany",

        quotaGB: body.quotaGB || 30,

        dailyLimitGB: body.dailyLimitGB || 1,

        usedGB: 0,

        todayUsedGB: 0,

        status: "active",

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString()

      });

      await env.DB.put("users", JSON.stringify(users));

      return new Response(JSON.stringify({
        success: true
      }), {
        headers: corsHeaders
      });

    }

    // ========================
    // DELETE USER
    // ========================
    if (path === "/deleteUser") {

      const body = await request.json();

      let users = JSON.parse(await env.DB.get("users") || "[]");

      users = users.filter(
        u => u.id !== body.id
      );

      await env.DB.put("users", JSON.stringify(users));

      return new Response(JSON.stringify({
        success: true
      }), {
        headers: corsHeaders
      });

    }

    return new Response(JSON.stringify({
      success: false,
      error: "Not Found"
    }), {
      status: 404,
      headers: corsHeaders
    });

  }
};
