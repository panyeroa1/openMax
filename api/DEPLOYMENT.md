# OpenMax Conversation Memory - VPS Deployment Guide

## Overview

This guide walks through deploying the conversation memory system to your VPS at **168.231.78.113**.

---

## Prerequisites

- SSH access to root@168.231.78.113
- Ubuntu 24.04.3 LTS (already installed)

---

## Deployment Steps

### Step 1: Upload Server Files to VPS

```bash
# From your local machine
ssh root@168.231.78.113 'mkdir -p /root/openmax/server'

# Upload all server files
scp -r server/* root@168.231.78.113:/root/openmax/server/
```

### Step 2: SSH to VPS and Setup PostgreSQL

```bash
ssh root@168.231.78.113
cd /root/openmax/server

# Make setup script executable
chmod +x setup-db.sh

# Run PostgreSQL setup
./setup-db.sh
```

This will:
- Install PostgreSQL
- Create `openmax_memory` database
- Create `openmax_user` with password `OmX_Secure_2026!`
- Run the schema to create tables and indexes

### Step 3: Install Node.js Dependencies

```bash
cd /root/openmax/server

# Copy .env.example to .env
cp .env.example .env

# Install dependencies
npm install
```

### Step 4: Start the API Server

```bash
# Start server (production)
npm start

# OR run in background with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name openmax-api
pm2 save
pm2 startup
```

The API will be available at `http://168.231.78.113:3001`

### Step 5: Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-05T..."}
```

### Step 6: Test Database Connection

```bash
# Connect to PostgreSQL
psql -U openmax_user -d openmax_memory -h 127.0.0.1

# Once connected, test:
\dt  # List tables (should show: conversations, messages)
\q   # Quit
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/:userId` | Get user's conversations |
| GET | `/api/conversation/:sessionId` | Get specific conversation |
| PATCH | `/api/conversation/:sessionId` | Update conversation title |
| POST | `/api/messages` | Save a message |
| GET | `/api/messages/:sessionId` | Get conversation messages |
| GET | `/api/search` | Search across messages |

---

## Troubleshooting

### PostgreSQL not starting

```bash
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 50
```

### API server errors

```bash
# Check server logs
pm2 logs openmax-api

# Restart server
pm2 restart openmax-api
```

### Can't connect to database

1. Check PostgreSQL is running: `systemctl status postgresql`
2. Verify credentials in `/root/openmax/server/.env`
3. Test manual connection: `psql -U openmax_user -d openmax_memory -h 127.0.0.1`

---

## Security Notes

> [!WARNING]
> - The API server is currently **not authenticated**. Add auth middleware in production.
> - Database password is hardcoded. Change it in both `schema.sql` and `.env`.
> - Consider adding UFW firewall rules to restrict port 3001 access.

---

## Next Steps

Once deployed, the frontend OpenMax app will automatically connect to the API at `http://168.231.78.113:3001` (configured in `.env.local`).

You can now:
- Create conversations
- Save messages automatically
- Load conversation history
- Search across all messages
