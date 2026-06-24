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

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return await res.json();
}

async function loadUsers() {
  const users = await api("/users");

  const list = users.length
    ? users.map(u => `<li>${u.username} | ${u.panel} | ${u.server}</li>`).join("")
    : "<li>هیچ کاربری ثبت نشده است.</li>";

  document.getElementById("users").innerHTML = list;
}

async function addUser() {
  const user = {
    username: document.getElementById("username").value,
    panel: document.getElementById("panel").value,
    server: document.getElementById("server").value,
    quotaGB: Number(document.getElementById("quota").value),
    dailyLimitGB: Number(document.getElementById("daily").value)
  };

  await api("/addUser", "POST", user);

  document.getElementById("username").value = "";

  await loadUsers();
}

document.getElementById("app").innerHTML = `
<h3>OpenProxyHub Dashboard</h3>

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

<input id="quota" type="number" value="30">

GB

<br><br>

<input id="daily" type="number" value="1">

GB / Day

<br><br>

<button id="addBtn">Add User</button>

<h3>Users</h3>

<ul id="users"></ul>
`;

document.getElementById("addBtn").onclick = addUser;

loadUsers();
