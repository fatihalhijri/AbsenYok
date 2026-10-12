/**
 * Penanda token yang sudah dipakai (in-memory, per proses) dengan TTL.
 * Catatan: tidak dibagi antar instance — bila backend dijalankan multi-instance,
 * gunakan penyimpanan bersama (mis. Redis) agar anti-replay tetap berlaku.
 */
export class ReplayGuard {
  private readonly entries = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  has(key: string, now: number = Date.now()): boolean {
    const expiresAt = this.entries.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  add(key: string, now: number = Date.now()): void {
    this.prune(now);
    this.entries.set(key, now + this.ttlMs);
  }

  get size(): number {
    return this.entries.size;
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(key);
    }
  }
}
