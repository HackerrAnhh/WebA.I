# Data Directory

This directory contains JSON files used as seed data for Docker and Render.

Runtime files that can contain private data are intentionally ignored by Git:

- `data_user.json`
- `data_order.json`
- `Question_Data.xlsx`

On Render, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` so the backend can create or update the admin account at startup. The persistent disk at `/app/data` stores users, orders, and uploaded runtime data after the first deploy.
