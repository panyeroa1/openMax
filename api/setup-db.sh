#!/bin/bash
# OpenMax - PostgreSQL Setup Script for VPS
# Run this script on your VPS as root.

set -e

echo "=== OpenMax PostgreSQL Setup ==="

# Resolve this script's directory so schema.sql can be found reliably.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_SQL="${SCRIPT_DIR}/schema.sql"

# Update package list
echo "[1/6] Updating package list..."
sudo apt update

# Install PostgreSQL
echo "[2/6] Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
echo "[3/6] Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "[4/6] Creating database and user..."
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='openmax_memory'" | grep -q 1; then
  sudo -u postgres createdb openmax_memory
fi

# Run schema
echo "[5/6] Creating schema..."
if [ ! -f "$SCHEMA_SQL" ]; then
  echo "Schema not found at: $SCHEMA_SQL"
  exit 1
fi
# /root is not readable by the postgres user; feed the schema via stdin instead.
sudo -u postgres psql -d openmax_memory < "$SCHEMA_SQL"

echo "✓ PostgreSQL setup complete!"
echo "Database: openmax_memory"
echo "User: openmax_user (created by schema.sql if not already present)"
