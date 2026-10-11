/** BUSINESS-RULES §13: minimal 8 karakter, wajib huruf besar, huruf kecil, dan angka. */
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  'Password minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, serta angka';
/** Batas atas panjang password agar hashing argon2 tidak bisa dipakai untuk DoS. */
export const PASSWORD_MAX_LENGTH = 128;
