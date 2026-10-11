import {
  type ArgumentsHost,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import type { ApiErrorResponse } from '@/common/types/api-response.type';
import type { AppConfigService } from '@/config/app.config';

class PrismaClientKnownRequestError extends Error {
  override name = 'PrismaClientKnownRequestError';
  constructor(
    public code: string,
    public meta?: Record<string, unknown>,
  ) {
    super(`Prisma error ${code}`);
  }
}

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, headersSent: false };
  const request = {
    method: 'POST',
    url: '/api/v1/attendance/scan',
    originalUrl: '/api/v1/attendance/scan',
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  return {
    host,
    status,
    body: () => json.mock.calls[0][0] as ApiErrorResponse,
  };
}

describe('AllExceptionsFilter', () => {
  const devFilter = new AllExceptionsFilter({ isProduction: false } as AppConfigService);
  const prodFilter = new AllExceptionsFilter({ isProduction: true } as AppConfigService);

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('BusinessException → kode, pesan, details, path & timestamp', () => {
    const { host, status, body } = createHost();
    devFilter.catch(
      new BusinessException(
        ErrorCode.OUTSIDE_GEOFENCE,
        'Anda berada 245 m dari lokasi kantor',
        422,
        {
          distance: 245,
          radius: 100,
        },
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(body()).toEqual({
      success: false,
      error: {
        code: 'OUTSIDE_GEOFENCE',
        message: 'Anda berada 245 m dari lokasi kantor',
        details: { distance: 245, radius: 100 },
      },
      path: '/api/v1/attendance/scan',
      timestamp: expect.any(String),
    });
    expect(new Date(body().timestamp).toISOString()).toBe(body().timestamp);
  });

  it('BusinessException tanpa pesan memakai pesan & status bawaan kontrak', () => {
    const { host, status, body } = createHost();
    devFilter.catch(new BusinessException(ErrorCode.ALREADY_CHECKED_IN), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(body().error).toEqual({ code: 'ALREADY_CHECKED_IN', message: 'Anda sudah absen masuk' });
  });

  it.each([
    [new NotFoundException('Cannot GET /x'), 404, ErrorCode.NOT_FOUND],
    [new UnauthorizedException(), 401, ErrorCode.TOKEN_INVALID],
  ])('HttpException bawaan Nest → kode standar (%#)', (exception, httpStatus, code) => {
    const { host, status, body } = createHost();
    devFilter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(httpStatus);
    expect(body().error.code).toBe(code);
  });

  it('503 meneruskan detail (hasil health check)', () => {
    const { host, status, body } = createHost();
    devFilter.catch(
      new ServiceUnavailableException({ status: 'error', error: { db: { status: 'down' } } }),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(body().error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(body().error.details).toMatchObject({ error: { db: { status: 'down' } } });
  });

  it('Prisma P2002 → 409 CONFLICT', () => {
    const { host, status, body } = createHost();
    devFilter.catch(new PrismaClientKnownRequestError('P2002', { target: ['email'] }), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(body().error).toEqual({
      code: 'CONFLICT',
      message: 'Data sudah ada',
      details: { target: ['email'] },
    });
  });

  it('Prisma P2025 → 404 NOT_FOUND', () => {
    const { host, status, body } = createHost();
    devFilter.catch(new PrismaClientKnownRequestError('P2025'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(body().error.code).toBe('NOT_FOUND');
  });

  it('kode Prisma lain → 500', () => {
    const { host, status } = createHost();
    devFilter.catch(new PrismaClientKnownRequestError('P2003'), host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('error tak dikenal di produksi → 500 tanpa stack', () => {
    const { host, status, body } = createHost();
    prodFilter.catch(new Error('koneksi putus: password=rahasia'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(body().error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server',
    });
    expect(JSON.stringify(body())).not.toContain('rahasia');
  });

  it('error tak dikenal di development menyertakan stack untuk debugging', () => {
    const { host, body } = createHost();
    devFilter.catch(new Error('boom'), host);

    expect(body().error.details).toMatchObject({
      name: 'Error',
      message: 'boom',
      stack: expect.any(String),
    });
  });

  it('tidak menulis respons bila header sudah terkirim', () => {
    const { host, status } = createHost();
    const response = host.switchToHttp().getResponse<{ headersSent: boolean }>();
    response.headersSent = true;
    devFilter.catch(new Error('stream error'), host);
    expect(status).not.toHaveBeenCalled();
  });
});
