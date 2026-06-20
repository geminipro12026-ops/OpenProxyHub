# OpenProxyHub Core

The Core is the central engine of OpenProxyHub.

It does NOT depend on any specific VPN panel.

## Responsibilities

- Manage servers (any type)
- Manage users (abstract model)
- Handle plugins
- Store configuration
- Sync data between devices

## Important Rule

The Core must NOT implement:
- BPB logic
- Nahan logic
- X-UI logic
- Any panel-specific logic

These must be handled by plugins only.

## Architecture Idea

App (Android / Flutter)
        ↓
     Core API
        ↓
   Plugin System
        ↓
  Panel Connectors
