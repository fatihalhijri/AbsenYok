import { parseDatabaseUrl } from '@/prisma/prisma-adapter';

const devDefaults = { allowPublicKeyRetrievalByDefault: true };
const prodDefaults = { allowPublicKeyRetrievalByDefault: false };

describe('parseDatabaseUrl()', () => {
  it('mengurai URL MySQL standar dan mengunci zona waktu sesi ke UTC', () => {
    expect(
      parseDatabaseUrl('mysql://absenyok:absenyok_secret@localhost:3306/absenyok', devDefaults),
    ).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'absenyok',
      password: 'absenyok_secret',
      database: 'absenyok',
      timezone: 'Z',
      connectionLimit: 10,
      connectTimeout: 5_000,
      acquireTimeout: 10_000,
      allowPublicKeyRetrieval: true,
    });
  });

  it('men-decode karakter khusus pada user & password', () => {
    const config = parseDatabaseUrl('mysql://app%40user:p%40ss%3Aw%2Frd@db/absenyok', devDefaults);
    expect(config.user).toBe('app@user');
    expect(config.password).toBe('p@ss:w/rd');
  });

  it('port default 3306 dan password kosong (root Laragon)', () => {
    const config = parseDatabaseUrl('mysql://root:@127.0.0.1/absenyok', devDefaults);
    expect(config.port).toBe(3306);
    expect(config.password).toBe('');
  });

  it('membaca opsi pool dari query string', () => {
    const config = parseDatabaseUrl(
      'mysql://u:p@db:3307/absenyok?connection_limit=5&connect_timeout=2000&pool_timeout=4000',
      devDefaults,
    );
    expect(config).toMatchObject({
      port: 3307,
      connectionLimit: 5,
      connectTimeout: 2_000,
      acquireTimeout: 4_000,
    });
  });

  it('allowPublicKeyRetrieval mati di produksi kecuali diaktifkan lewat URL', () => {
    expect(parseDatabaseUrl('mysql://u:p@db/absenyok', prodDefaults).allowPublicKeyRetrieval).toBe(
      false,
    );
    expect(
      parseDatabaseUrl('mysql://u:p@db/absenyok?allowPublicKeyRetrieval=true', prodDefaults)
        .allowPublicKeyRetrieval,
    ).toBe(true);
    expect(
      parseDatabaseUrl('mysql://u:p@db/absenyok?allowPublicKeyRetrieval=false', devDefaults)
        .allowPublicKeyRetrieval,
    ).toBe(false);
  });

  it.each([
    ['postgres://u:p@db/absenyok', /skema mysql/],
    ['mysql://u:p@db', /nama database/],
    ['mysql://u:p@db/absenyok?connection_limit=0', /connection_limit/],
    ['mysql://u:p@db/absenyok?connect_timeout=abc', /connect_timeout/],
  ])('menolak %s', (url, message) => {
    expect(() => parseDatabaseUrl(url, devDefaults)).toThrow(message);
  });
});
