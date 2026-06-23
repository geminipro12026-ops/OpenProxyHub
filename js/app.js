import { getUsers } from "./api.js";

async function loadApp() {
  const app = document.getElementById("app");

  try {
    const users = await getUsers();

    app.innerHTML = `
      <div class="card">
        🚀 OpenProxyHub Dashboard

        <h3>Users</h3>

        <ul>
          ${users.map(u => `<li>${u.name || "Unnamed User"}</li>`).join("")}
        </ul>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `
      <div class="card">
        ❌ Error loading data
      </div>
    `;
  }
}

loadApp();
