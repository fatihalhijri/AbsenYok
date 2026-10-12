# CLAUDE.md — Instruksi Proyek AbsenYok

File ini dibaca otomatis oleh Claude Code setiap sesi.

## Konteks wajib
@docs/00-MASTER-CONTEXT.md

Dokumen lain dibaca saat relevan: docs/ARCHITECTURE.md, docs/BUSINESS-RULES.md, docs/DATABASE.md, docs/API-CONTRACT.md, docs/QR-SECURITY.md.

## Alur kerja
1. Kerjakan HANYA satu file prompt per sesi (mis. backend/prompts/01-setup-project.md).
2. Sebelum menulis kode: baca prompt tersebut + PROMPT.md induknya (backend/PROMPT.md atau frontend/PROMPT.md), lalu tampilkan rencana singkat dan tunggu persetujuan saya.
3. Setelah selesai: jalankan lint, build, dan test yang relevan; perbaiki sampai lulus.
4. Akhiri dengan: daftar file yang dibuat/diubah, perintah untuk mencoba, checklist "Kriteria Selesai" (✅/❌), dan bagian "Perubahan Kontrak" bila ada.
5. Setiap selesai satu prompt, perbarui `PROGRESS.md` di root: Status (⬜/🟡/✅), Tanggal, Commit (isi setelah di-commit), dan Catatan berisi kendala serta hal yang belum tuntas.
6. Jangan commit tanpa saya minta. Format commit: Conventional Commits.

## Larangan
- Jangan mengubah model di backend/prisma/schema.prisma tanpa izin.
- Jangan menimpa .env.example, prisma.config.ts, atau file docs/.
- Jangan menaruh secret di kode.

## Perintah penting
- Database: `docker compose up -d mysql adminer` (dari root)
- Backend: `cd backend && npm run start:dev`
- Frontend: `cd frontend && npm run dev`
