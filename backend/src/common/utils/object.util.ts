/**
 * Buang properti bernilai `undefined`. DTO (class) menyimpan field opsional yang tidak dikirim
 * sebagai `undefined` (useDefineForClassFields), sehingga spread `{ ...defaults, ...dto }`
 * akan menimpa default — gunakan `{ ...defaults, ...omitUndefined(dto) }`.
 */
export function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
