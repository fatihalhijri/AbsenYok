import * as argon2 from 'argon2';

/** Hash password dengan argon2id (BUSINESS-RULES §13). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** `false` juga untuk hash yang rusak/tidak dikenali (tidak melempar error). */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
