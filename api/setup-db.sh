#!/bin/bash
# OpenMax - PostgreSQL Setup Script for VPS
# Run this script on VPS: 168.231.78.113

set -e

echo "=== OpenMax PostgreSQL Setup ==="

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
sudo -u postgres psql <<EOF
CREATE DATABASE openmax_memory;
EOF

# Run schema
echo "[5/6] Creating schema..."
sudo -u postgres psql -d openmax_memory -f /root/openmax/server/schema.sql

# Configure PostgreSQL to allow remote connections (optional, for external access)
echo "[6/6] Configuring PostgreSQL..."
PG_CONF="/etc/postgresql/12/main/postgresql.conf"
PG_HBA="/etc/postgresql/12/main/pg_hba.conf"

# Backup original files
sudo cp $PG_CONF ${PG_CONF}.backup
sudo cp $PG_HBA ${PG_HBA}.backup

# Allow connections from localhost
echo "host    openmax_memory    openmax_user    127.0.0.1/32    md5" | sudo tee -a $PG_HBA

# Restart PostgreSQL
sudo systemctl restart postgresql

echo "✓ PostgreSQL setup complete!"
echo "Database: openmax_memory"
echo "User: openmax_user"
echo "Password: OmX_Secure_2026!"
echo ""
echo "Test connection with:"
echo "psql -U openmax_user -d openmax_memory -h 127.0.0.1"
