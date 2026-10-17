import { getImageProps } from 'next/image';
import { AvatarImage } from '@/components/ui/avatar';

interface AvatarPhotoProps {
  /** `/uploads/avatars/….webp` dari backend. */
  src: string;
  alt?: string;
  /** Ukuran tampil terbesar (px) — optimizer menyiapkan 1x & 2x. */
  size?: number;
  className?: string;
}

/**
 * Foto avatar yang dioptimasi `next/image` (ukuran pas + AVIF/WebP) namun tetap memakai
 * `AvatarImage` Radix agar inisial (fallback) tampil selama memuat atau bila gambar gagal.
 */
export function AvatarPhoto({ src, alt = '', size = 40, className }: AvatarPhotoProps) {
  const { props } = getImageProps({ src, alt, width: size, height: size, quality: 80 });
  return (
    <AvatarImage
      src={props.src}
      srcSet={props.srcSet}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
