// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveApi } from '../api';
import { AttachmentField } from './attachment-field';

afterEach(cleanup);

function Harness({ onChange }: { onChange: (file: File | null) => void }) {
  const [value, setValue] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <AttachmentField
      value={value}
      onChange={(file) => {
        setValue(file);
        onChange(file);
      }}
      onError={setError}
      error={error ?? undefined}
      required
    />
  );
}

const pick = (input: HTMLElement, file: File) =>
  fireEvent.change(input, { target: { files: [file] } });

describe('AttachmentField', () => {
  it('menolak PDF > 2 MB sebelum upload (tanpa request)', async () => {
    const create = vi.spyOn(leaveApi, 'create');
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const input = container.querySelector('input[type="file"]:not([capture])') as HTMLElement;

    pick(
      input,
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'surat.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText('Ukuran file 2 MB — maksimal 2 MB')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('attachment-name')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('PDF valid → nama & ukuran tampil, bisa dihapus', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    const input = container.querySelector('input[type="file"]:not([capture])') as HTMLElement;

    pick(
      input,
      new File([new Uint8Array(300 * 1024)], 'surat-dokter.pdf', { type: 'application/pdf' }),
    );

    expect((await screen.findByTestId('attachment-name')).textContent).toBe('surat-dokter.pdf');
    expect(screen.getByText('300 KB')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hapus lampiran' }));
    await waitFor(() => expect(screen.queryByTestId('attachment-name')).toBeNull());
  });

  it('menyediakan input kamera langsung (capture="environment")', () => {
    const { container } = render(<Harness onChange={vi.fn()} />);
    const camera = container.querySelector('input[capture]');
    expect(camera?.getAttribute('capture')).toBe('environment');
    expect(camera?.getAttribute('accept')).toBe('image/*');
  });
});
