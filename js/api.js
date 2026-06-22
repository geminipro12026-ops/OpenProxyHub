const API_URL = "https://YOUR-WORKER-URL";

export async function getUsers() {
  const res = await fetch(API_URL + "/users");
  return await res.json();
}

export async function addUser(user) {
  const res = await fetch(API_URL + "/addUser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(user)
  });

  return await res.json();
}
