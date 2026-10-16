'use client';

import { Loader2Icon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { cropSquare, loadImage } from '@/lib/image';
import {
  centeredView,
  clampView,
  type CropView,
  cropAreaOf,
  scaleFor,
  zoomAroundCenter,
} from '../crop-math';

const VIEWPORT = 280;
const MAX_ZOOM = 3;

interface AvatarCropDialogProps {
  /** File gambar yang dipilih; `null` = dialog tertutup. */
  file: File | null;
  onCancel: () => void;
  /** Dipanggil dengan hasil crop 512×512 JPEG; boleh async (tombol menampilkan loading). */
  onConfirm: (file: File) => Promise<void>;
  progress?: number;
}

/** Crop persegi sederhana: geser gambar & atur zoom, lalu simpan. */
export function AvatarCropDialog({ file, onCancel, onConfirm, progress }: AvatarCropDialogProps) {
  const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(null);
  const [view, setView] = useState<CropView>({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; start: CropView } | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const url = URL.createObjectURL(file);
    loadImage(file)
      .then((loaded) => {
        if (cancelled) return;
        const natural = { width: loaded.naturalWidth, height: loaded.naturalHeight };
        setImage({ url, ...natural });
        setView(centeredView(natural, VIEWPORT));
        setError(null);
      })
      .catch(() => !cancelled && setError('Gambar tidak dapat dibaca. Pilih foto JPG/PNG/WebP.'));
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [file]);

  const natural = image ? { width: image.width, height: image.height } : null;
  const scale = natural ? scaleFor(natural, VIEWPORT, view.zoom) : 1;

  const onPointerDown = (event: React.PointerEvent) => {
    if (!natural || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: view };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !natural) return;
    setView(
      clampView(
        {
          zoom: current.start.zoom,
          x: current.start.x + event.clientX - current.x,
          y: current.start.y + event.clientY - current.y,
        },
        natural,
        VIEWPORT,
      ),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  const setZoom = (zoom: number) => {
    if (natural) setView((current) => zoomAroundCenter(current, zoom, natural, VIEWPORT));
  };

  const save = async () => {
    if (!file || !natural) return;
    setSaving(true);
    try {
      const cropped = await cropSquare(file, cropAreaOf(view, natural, VIEWPORT));
      await onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atur foto profil</DialogTitle>
          <DialogDescription>
            Geser untuk memposisikan, gunakan slider untuk zoom.
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full bg-muted select-none"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="img"
          aria-label="Area potong foto"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob lokal untuk crop
            <img
              src={image.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left cursor-grab"
              style={{
                width: image.width,
                height: image.height,
                transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
              }}
            />
          ) : error ? (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
              {error}
            </p>
          ) : (
            <Loader2Icon className="absolute inset-0 m-auto size-8 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomOutIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <Slider
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={[view.zoom]}
            onValueChange={([zoom]) => zoom !== undefined && setZoom(zoom)}
            aria-label="Zoom"
            disabled={!image || saving}
          />
          <ZoomInIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>

        {saving && progress !== undefined ? (
          <Progress value={progress} className="h-2" aria-label="Progres unggah foto" />
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
          <Button className="min-h-11" onClick={() => void save()} disabled={!image || saving}>
            {saving ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            Simpan foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
