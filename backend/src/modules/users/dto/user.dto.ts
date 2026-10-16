import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '@/common/constants/password-policy';
import { Role } from '@/common/constants/roles';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import {
  IsOptionalNonNull,
  PARTIAL_REJECT_NULL,
} from '@/common/validators/is-optional-non-null.validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Spasi, tanda hubung, titik, dan kurung dibuang: "0812-3456 7890" → "081234567890". */
const normalizePhone = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value;

export const EMPLOYEE_CODE_PATTERN = /^[A-Z0-9._-]{2,30}$/;
export const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const ROLES = Object.values(Role);
const notNull = (_: object, value: unknown) => value !== null;

export class CreateUserDto {
  @ApiProperty({ example: 'EMP011', description: 'NIP/NIK; disimpan huruf besar' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Kode karyawan wajib diisi' })
  @Matches(EMPLOYEE_CODE_PATTERN, {
    message:
      'Kode karyawan 2–30 karakter berupa huruf, angka, titik, garis bawah, atau tanda hubung',
  })
  employeeCode: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter' })
  name: string;

  @ApiProperty({ example: 'budi.santoso@absenyok.id' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email: string;

  @ApiPropertyOptional({ type: String, example: '081234567890', nullable: true })
  @IsOptional()
  @Transform(normalizePhone)
  @ValidateIf(notNull)
  @Matches(PHONE_PATTERN, { message: 'Nomor telepon harus 8–15 digit (boleh diawali +)' })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Software Engineer', nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf(notNull)
  @IsString({ message: 'Jabatan harus berupa teks' })
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  position?: string | null;

  @ApiProperty({ example: 'Karyawan@123', description: PASSWORD_POLICY_MESSAGE })
  @IsString({ message: 'Password wajib diisi' })
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  password: string;

  @ApiPropertyOptional({
    enum: ROLES,
    default: Role.EMPLOYEE,
    description: 'ADMIN hanya boleh membuat EMPLOYEE',
  })
  @IsOptionalNonNull()
  @IsEnum(Role, { message: `Role harus salah satu dari: ${ROLES.join(', ')}` })
  role?: Role;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsUUID('all', { message: 'departmentId harus UUID' })
  departmentId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf(notNull)
  @IsUUID('all', { message: 'shiftId harus UUID' })
  shiftId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Lokasi kerja default',
  })
  @IsOptional()
  @ValidateIf(notNull)
  @IsUUID('all', { message: 'locationId harus UUID' })
  locationId?: string | null;
}

/** Partial update tanpa password (password lewat `reset-password`). */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
  PARTIAL_REJECT_NULL,
) {}

export class UpdateUserStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean({ message: 'isActive harus boolean' })
  isActive: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'PasswordBaru123', description: PASSWORD_POLICY_MESSAGE })
  @IsString({ message: 'Password baru wajib diisi' })
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  newPassword: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString({ message: 'Nama harus berupa teks' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter' })
  name?: string;

  @ApiPropertyOptional({ type: String, example: '081234567890', nullable: true })
  @IsOptional()
  @Transform(normalizePhone)
  @ValidateIf(notNull)
  @Matches(PHONE_PATTERN, { message: 'Nomor telepon harus 8–15 digit (boleh diawali +)' })
  phone?: string | null;
}

export const USER_SORT_FIELDS = [
  'name',
  'employeeCode',
  'email',
  'createdAt',
  'lastLoginAt',
] as const;

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptionalNonNull()
  @IsEnum(Role, { message: `role harus salah satu dari: ${ROLES.join(', ')}` })
  role?: Role;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId harus UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsIn([true, false], { message: 'isActive harus true atau false' })
  isActive?: boolean;
}
