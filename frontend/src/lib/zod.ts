import { z } from 'zod';

/**
 * Zod v4 menguji `new Function` untuk mode JIT; CSP (tanpa 'unsafe-eval') memblokirnya dan
 * mencatat pelanggaran di konsol. Semua skema mengimpor Zod lewat modul ini sehingga mode
 * jitless sudah terpasang sebelum skema pertama di-parse.
 */
z.config({ jitless: true });

export { z };
