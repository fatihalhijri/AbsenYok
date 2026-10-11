import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isDateString } from '@/common/utils/date.util';

/** Tanggal kalender valid berformat `YYYY-MM-DD` (menolak 2026-02-30). */
export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: { message: 'Tanggal harus berformat YYYY-MM-DD yang valid', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isDateString(value),
      },
    });
  };
}
