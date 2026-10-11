import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '@/common/constants/password-policy';
import { EMPLOYEE_CODE_PATTERN, PHONE_PATTERN } from './user.dto';

const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Satu baris file import (semua sel dibaca sebagai teks). */
export class ImportUserRowDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Kode karyawan wajib diisi' })
  @Matches(EMPLOYEE_CODE_PATTERN, {
    message:
      'Kode karyawan 2–30 karakter berupa huruf, angka, titik, garis bawah, atau tanda hubung',
  })
  employeeCode: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama wajib diisi' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter' })
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? value.replace(/[\s\-().]/g, '') : undefined,
  )
  @Matches(PHONE_PATTERN, { message: 'Nomor telepon harus 8–15 digit (boleh diawali +)' })
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  position?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : undefined,
  )
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  shiftName?: string;

  @IsString({ message: 'Password wajib diisi' })
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  password: string;
}
