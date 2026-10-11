import { type CallHandler, type ExecutionContext, StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptor';

describe('TransformResponseInterceptor', () => {
  const interceptor = new TransformResponseInterceptor();
  const context = {} as ExecutionContext;
  const run = (value: unknown) => {
    const next: CallHandler = { handle: () => of(value) };
    return firstValueFrom(interceptor.intercept(context, next));
  };

  it('membungkus objek biasa', async () => {
    await expect(run({ status: 'ok' })).resolves.toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('undefined menjadi data: null', async () => {
    await expect(run(undefined)).resolves.toEqual({ success: true, data: null });
  });

  it('mengubah { items, meta } menjadi data + meta', async () => {
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    await expect(run({ items: [{ id: '1' }], meta })).resolves.toEqual({
      success: true,
      data: [{ id: '1' }],
      meta,
    });
  });

  it('objek dengan items tetapi meta tidak lengkap tidak diubah', async () => {
    const value = { items: [], meta: { page: 1 } };
    await expect(run(value)).resolves.toEqual({ success: true, data: value });
  });

  it('melewatkan StreamableFile', async () => {
    const file = new StreamableFile(Buffer.from('xlsx'));
    await expect(run(file)).resolves.toBe(file);
  });
});
