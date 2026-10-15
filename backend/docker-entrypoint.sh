#!/bin/sh
# Terapkan migrasi yang belum berjalan, lalu jalankan API sebagai PID 1 (menerima SIGTERM).
set -e

echo "[entrypoint] Menerapkan migrasi database (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[entrypoint] Menjalankan AbsenYok API..."
exec node dist/main.js
