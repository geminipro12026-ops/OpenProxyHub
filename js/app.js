const API_BASE = "https://openproxyhub-api.openproxyhub.workers.dev";
const API_KEY = "oph_v1_7Qx9LmP2aW8Rk5ZtN4HsE1YbUc6VfJ3";

async function getUsers() {
  const res = await fetch(API_BASE + "/users", {
    headers: {
      "X-API-Key": API_KEY
    }
  });

  return await res.json();
}

async function loadApp() {
  const app = document.getElementById("app");

  app.innerHTML = "Loading...";

  try {
    const users = await getUsers();

    app.innerHTML = `
      <div class="card">
        🚀 OpenProxyHub Dashboard

        <h3>Users</h3>

        <ul>
          ${users.length
            ? users.map(u => `<li>${u.name || "Unnamed User"}</li>`).join("")
            : "<li>No users yet</li>"
          }
        </ul>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `
      <div class="card">
        ❌ Error loading users
      </div>
    `;
  }
}

loadApp();
