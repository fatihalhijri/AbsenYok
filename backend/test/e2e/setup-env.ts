import { loadTestEnv } from './test-db';

// Env test: .env lokal (sisanya dari .env.example) dengan DATABASE_URL → database `<nama>_test`.
loadTestEnv();
