const API_BASE = "https://openproxyhub-api.openproxyhub.workers.dev";
const API_KEY = "oph_v1_7Qx9LmP2aW8Rk5ZtN4HsE1YbUc6VfJ3";

async function api(path, method = "GET", body = null) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: body ? JSON.stringify(body) : null
  });

  const data = await res.json().catch(() => ({ success: false, error: "Invalid response" }));

  if (!res.ok) throw new Error(data.error || "API error");

  return data;
}

async function loadUsers() {
  const users = await api("/users");

  const container = document.getElementById("users");
  container.innerHTML = "";

  users.forEach(u => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <b>${u.username}</b><br>
      Panel: ${u.panel}<br>
      Server: ${u.server}<br>
      Quota: ${u.quotaGB} GB<br>
      Daily: ${u.dailyLimitGB} GB<br><br>
      <button id="del-${u.id}">Delete</button>
    `;

    container.appendChild(card);

    document.getElementById(`del-${u.id}`).onclick = async () => {
      if (!confirm("Delete this user?")) return;

      await api("/deleteUser", "POST", { id: u.id });

      loadUsers();
    };
  });
}

async function addUser() {
  const username = document.getElementById("username").value.trim();
  const panel = document.getElementById("panel").value;
  const server = document.getElementById("server").value;
  const quotaGB = Number(document.getElementById("quota").value);
  const dailyLimitGB = Number(document.getElementById("daily").value);
  const msg = document.getElementById("msg");

  msg.textContent = "";

  try {
    await api("/addUser", "POST", {
      username,
      panel,
      server,
      quotaGB,
      dailyLimitGB
    });

    document.getElementById("username").value = "";

    loadUsers();

  } catch (e) {
    msg.textContent = e.message;
  }
}

document.getElementById("app").innerHTML = `
<h3>OpenProxyHub Dashboard</h3>

<div id="msg" style="color:red"></div>

<input id="username" placeholder="Username"><br><br>

<select id="panel">
  <option>BPB</option>
  <option>Nahan</option>
</select>

<br><br>

<select id="server">
  <option>Germany</option>
  <option>Finland</option>
</select>

<br><br>

<input id="quota" type="number" value="30"> GB<br><br>

<input id="daily" type="number" value="1"> GB / Day<br><br>

<button id="addBtn">Add User</button>

<hr>

<div id="users"></div>
`;

document.getElementById("addBtn").onclick = addUser;

loadUsers();
