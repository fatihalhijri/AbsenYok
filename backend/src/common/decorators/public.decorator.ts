import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Menandai endpoint yang boleh diakses tanpa access token (dilewati JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
