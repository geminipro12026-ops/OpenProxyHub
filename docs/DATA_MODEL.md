# Data Model

## User

Each user has:

- id
- name
- uuid
- totalQuota (GB)
- usedQuota (GB)
- dailyQuota (GB)
- expireDate
- status (active / inactive)

## Server

Each server has:

- id
- name
- type (BPB, Nahan, etc.)
- address
- status
- pluginId

## Rule

Data must be independent from any panel.
