import { config } from 'dotenv';

// Env test: pakai .env lokal bila ada, sisanya diisi dari .env.example (tidak menimpa).
process.env.NODE_ENV = 'test';
config({ path: ['.env', '.env.example'], quiet: true });
