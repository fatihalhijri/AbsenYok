import { Controller, Get, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { ErrorCode } from '@/common/constants/error-codes';
import { Public } from '@/common/decorators/public.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { BusinessException } from '@/common/exceptions/business.exception';
import { paginate } from '@/common/utils/paginate.util';
import { PrismaService } from '@/prisma/prisma.service';

/** Stub Prisma: e2e lapisan HTTP tidak membutuhkan MySQL yang menyala. */
const prismaStub = {
  $queryRaw: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
};

/** Controller khusus test untuk memverifikasi lapisan common (pipe, interceptor, filter). */
@Controller('e2e-probe')
class ProbeController {
  @Public()
  @Get('list')
  list(@Query() query: PaginationQueryDto) {
    return paginate(
      [{ id: '1', search: query.search ?? null, sortOrder: query.sortOrder }],
      45,
      query,
    );
  }

  @Public()
  @Get('business-error')
  businessError(): never {
    throw new BusinessException(ErrorCode.QR_EXPIRED);
  }

  @Public()
  @Get('crash')
  crash(): never {
    throw new Error('rahasia internal');
  }
}

describe('AbsenYok API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    beforeEach(() => prismaStub.$queryRaw.mockResolvedValue([{ 1: 1 }]));
    afterEach(() => prismaStub.$queryRaw.mockReset());

    it.each(['/api/v1/health', '/health'])('GET %s → status ok, db up', async (path) => {
      const res = await request(http).get(path).expect(200);

      expect(res.body).toEqual({
        success: true,
        data: { status: 'ok', db: 'up', time: expect.any(String) },
      });
    });

    it('database mati → 503 SERVICE_UNAVAILABLE tanpa membocorkan detail koneksi', async () => {
      prismaStub.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3306'));

      const res = await request(http).get('/api/v1/health').expect(503);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(res.body.error.details.error).toEqual({
        db: { status: 'down', message: 'Database tidak dapat dihubungi' },
      });
      expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
    });
  });

  describe('Format error', () => {
    it('rute tidak dikenal → 404 NOT_FOUND', async () => {
      const res = await request(http).get('/api/v1/tidak-ada').expect(404);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' },
        path: '/api/v1/tidak-ada',
        timestamp: expect.any(String),
      });
    });

    it('rute tanpa prefix /api/v1 tidak tersedia', async () => {
      await request(http).get('/e2e-probe/list').expect(404);
    });

    it('BusinessException → kode & status kontrak', async () => {
      const res = await request(http).get('/api/v1/e2e-probe/business-error').expect(422);
      expect(res.body.error).toEqual({
        code: 'QR_EXPIRED',
        message: 'QR Code kedaluwarsa, silakan scan ulang',
      });
    });

    it('error tak terduga → 500 INTERNAL_ERROR', async () => {
      const res = await request(http).get('/api/v1/e2e-probe/crash').expect(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('JSON rusak → 400 BAD_REQUEST', async () => {
      const res = await request(http)
        .post('/api/v1/e2e-probe/list')
        .set('Content-Type', 'application/json')
        .send('{rusak')
        .expect(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Validasi & paginasi', () => {
    it('membungkus { items, meta } dan menerapkan default query', async () => {
      const res = await request(http)
        .get('/api/v1/e2e-probe/list?page=3&search=%20budi%20')
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        data: [{ id: '1', search: 'budi', sortOrder: 'desc' }],
        meta: { page: 3, limit: 20, total: 45, totalPages: 3 },
      });
    });

    it('limit > 100 → 400 VALIDATION_ERROR dengan details per field', async () => {
      const res = await request(http).get('/api/v1/e2e-probe/list?limit=500&page=0').expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          { field: 'limit', messages: ['limit maksimal 100'] },
          { field: 'page', messages: ['page minimal 1'] },
        ]),
      );
    });

    it('query tak dikenal ditolak (forbidNonWhitelisted)', async () => {
      const res = await request(http).get('/api/v1/e2e-probe/list?hack=1').expect(400);
      expect(res.body.error.details).toEqual([
        { field: 'hack', messages: ['property hack should not exist'] },
      ]);
    });
  });

  describe('Keamanan & dokumentasi', () => {
    it('header keamanan helmet & request id', async () => {
      const res = await request(http).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-request-id']).toEqual(expect.any(String));
    });

    it('CORS mengizinkan origin terdaftar dengan credentials', async () => {
      const res = await request(http)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS menolak origin asing', async () => {
      const res = await request(http).get('/api/v1/health').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('Swagger tersedia di /api/docs (non-produksi)', async () => {
      await request(http).get('/api/docs').expect(200).expect('Content-Type', /html/);
      const doc = await request(http).get('/api/docs-json').expect(200);
      expect(doc.body.components.securitySchemes.bearer).toMatchObject({
        type: 'http',
        scheme: 'bearer',
      });
    });
  });
});
