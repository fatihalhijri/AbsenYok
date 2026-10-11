import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} from '@/common/constants/password-policy';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Karyawan@123' })
  @IsString({ message: 'Password saat ini wajib diisi' })
  @IsNotEmpty({ message: 'Password saat ini wajib diisi' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  currentPassword: string;

  @ApiProperty({ example: 'PasswordBaru123', description: PASSWORD_POLICY_MESSAGE })
  @IsString({ message: 'Password baru wajib diisi' })
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password maksimal ${PASSWORD_MAX_LENGTH} karakter` })
  newPassword: string;
}
