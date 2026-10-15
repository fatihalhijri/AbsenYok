import { config } from 'dotenv';

// Unit test hermetis: env diisi dari .env.example (bukan .env lokal) sehingga hasil di mesin
// developer dan CI identik. Variabel yang sudah ada di environment tidak ditimpa.
process.env.NODE_ENV = 'test';
config({ path: '.env.example', quiet: true });
