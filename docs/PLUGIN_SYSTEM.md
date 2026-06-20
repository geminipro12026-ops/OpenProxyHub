# OpenProxyHub Plugin System

## Goal

Allow OpenProxyHub to support ANY VPN or proxy panel without changing the core.

Each panel is implemented as a plugin.

---

## Plugin Structure

Each plugin must implement these functions:

- createUser()
- deleteUser()
- updateUser()
- getUser()
- listUsers()
- getUsage()

---

## Example Plugins

- BPB Plugin
- Nahan Plugin
- Marzban Plugin
- X-UI Plugin
- Hiddify Plugin
- Future Unknown Panels

---

## Rule

The Core must NEVER communicate directly with a panel.

Only plugins can do that.

---

## Future Idea

Plugins can be installed or updated without updating the main app.

This allows OpenProxyHub to grow without limits.
