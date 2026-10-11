import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '@/common/constants/password-policy';

export class LoginDto {
  @ApiProperty({ example: 'admin@absenyok.id' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email: string;

  @ApiProperty({ example: 'Admin@12345' })
  @IsString({ message: 'Password wajib diisi' })
  @IsNotEmpty({ message: 'Password wajib diisi' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  password: string;
}
