const API_BASE = "https://openproxyhub-api.openproxyhub.workers.dev";
const API_KEY = "oph_v1_7Qx9LmP2aW8Rk5ZtN4HsE1YbUc6VfJ3";

// ===== Helper =====
async function request(path, method = "GET", body = null) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    throw new Error("API Error: " + res.status);
  }

  return await res.json();
}

// ===== USERS =====
export async function getUsers() {
  return await request("/users");
}

export async function addUser(user) {
  return await request("/addUser", "POST", user);
}
