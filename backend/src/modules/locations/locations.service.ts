import { Injectable } from '@nestjs/common';
import { conflictError, notFoundError } from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  type CreateLocationDto,
  LOCATION_SORT_FIELDS,
  type LocationQueryDto,
  type UpdateLocationDto,
} from './dto/location.dto';

const LOCATION_SELECT = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { kiosks: true, users: { where: { deletedAt: null } } } },
} satisfies Prisma.LocationSelect;

type LocationRow = Prisma.LocationGetPayload<{ select: typeof LOCATION_SELECT }>;

export type LocationView = Omit<LocationRow, '_count' | 'latitude' | 'longitude'> & {
  latitude: number;
  longitude: number;
  kioskCount: number;
  userCount: number;
};

/** Decimal(10,7) dikirim sebagai number agar mudah dipakai peta/geofence di frontend. */
const toView = ({ _count, latitude, longitude, ...location }: LocationRow): LocationView => ({
  ...location,
  latitude: latitude.toNumber(),
  longitude: longitude.toNumber(),
  kioskCount: _count.kiosks,
  userCount: _count.users,
});

const toDecimalInput = (value: number | undefined) =>
  value === undefined ? undefined : value.toFixed(7);

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: LocationQueryDto): Promise<PaginatedResult<LocationView>> {
    const where: Prisma.LocationWhereInput = query.search
      ? { OR: [{ name: { contains: query.search } }, { address: { contains: query.search } }] }
      : {};
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, LOCATION_SORT_FIELDS, 'name');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        orderBy,
        select: LOCATION_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.location.count({ where }),
    ]);
    return paginate(rows.map(toView), total, query);
  }

  async findOne(id: string): Promise<LocationView> {
    const row = await this.prisma.location.findUnique({ where: { id }, select: LOCATION_SELECT });
    if (!row) throw notFoundError('Lokasi tidak ditemukan');
    return toView(row);
  }

  async create(dto: CreateLocationDto): Promise<LocationView> {
    const row = await this.prisma.location.create({
      data: {
        ...dto,
        latitude: dto.latitude.toFixed(7),
        longitude: dto.longitude.toFixed(7),
      },
      select: LOCATION_SELECT,
    });
    return toView(row);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationView> {
    await this.findOne(id);
    const row = await this.prisma.location.update({
      where: { id },
      data: {
        ...dto,
        latitude: toDecimalInput(dto.latitude),
        longitude: toDecimalInput(dto.longitude),
      },
      select: LOCATION_SELECT,
    });
    return toView(row);
  }

  /**
   * Ditolak (409) bila masih dipakai kiosk. Kiosk nonaktif juga dihitung karena relasi
   * kiosk → lokasi wajib (penghapusan akan gagal di level database).
   */
  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);
    if (location.kioskCount > 0) {
      const activeKiosks = await this.prisma.kiosk.count({
        where: { locationId: id, isActive: true },
      });
      throw conflictError(
        activeKiosks > 0
          ? `Lokasi masih dipakai ${activeKiosks} kiosk aktif`
          : `Lokasi masih terhubung dengan ${location.kioskCount} kiosk nonaktif; hapus kiosk terlebih dahulu`,
      );
    }
    await this.prisma.location.delete({ where: { id } });
  }
}
