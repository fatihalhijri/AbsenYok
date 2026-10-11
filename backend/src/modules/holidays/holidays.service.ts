import { Injectable } from '@nestjs/common';
import { conflictError, notFoundError, validationError } from '@/common/exceptions/error-factories';
import { fromDbDate, toDbDate, todayDateString } from '@/common/utils/date.util';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  BulkCreateHolidayDto,
  CreateHolidayDto,
  HolidayQueryDto,
  UpdateHolidayDto,
} from './dto/holiday.dto';

export interface HolidayView {
  id: string;
  date: string;
  name: string;
}

export interface BulkHolidayResult {
  created: number;
  skipped: number;
}

const HOLIDAY_SELECT = { id: true, date: true, name: true } as const;

const toView = (row: { id: string; date: Date; name: string }): HolidayView => ({
  id: row.id,
  date: fromDbDate(row.date),
  name: row.name,
});

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Hari libur dalam satu tahun (default tahun berjalan), urut tanggal. */
  async list(query: HolidayQueryDto): Promise<HolidayView[]> {
    const year = query.year ?? Number(todayDateString().slice(0, 4));
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } },
      orderBy: { date: 'asc' },
      select: HOLIDAY_SELECT,
    });
    return rows.map(toView);
  }

  async findOne(id: string): Promise<HolidayView> {
    const row = await this.prisma.holiday.findUnique({ where: { id }, select: HOLIDAY_SELECT });
    if (!row) throw notFoundError('Hari libur tidak ditemukan');
    return toView(row);
  }

  async create(dto: CreateHolidayDto): Promise<HolidayView> {
    await this.assertDateAvailable(dto.date);
    const row = await this.prisma.holiday.create({
      data: { date: toDbDate(dto.date), name: dto.name },
      select: HOLIDAY_SELECT,
    });
    return toView(row);
  }

  async update(id: string, dto: UpdateHolidayDto): Promise<HolidayView> {
    await this.findOne(id);
    if (dto.date) await this.assertDateAvailable(dto.date, id);
    const row = await this.prisma.holiday.update({
      where: { id },
      data: { name: dto.name, ...(dto.date && { date: toDbDate(dto.date) }) },
      select: HOLIDAY_SELECT,
    });
    return toView(row);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.holiday.delete({ where: { id } });
  }

  /** Tanggal duplikat di payload → 400; tanggal yang sudah ada di database dilewati. */
  async bulkCreate(dto: BulkCreateHolidayDto): Promise<BulkHolidayResult> {
    const seen = new Map<string, number>();
    const duplicates = dto.items.flatMap((item, index) => {
      const first = seen.get(item.date);
      seen.set(item.date, first ?? index);
      return first === undefined
        ? []
        : [
            {
              field: `items.${index}.date`,
              messages: [`Tanggal ${item.date} duplikat dengan items.${first}`],
            },
          ];
    });
    if (duplicates.length > 0) throw validationError(duplicates);

    const { count } = await this.prisma.holiday.createMany({
      data: dto.items.map((item) => ({ date: toDbDate(item.date), name: item.name })),
      skipDuplicates: true,
    });
    return { created: count, skipped: dto.items.length - count };
  }

  private async assertDateAvailable(date: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.holiday.findFirst({
      where: { date: toDbDate(date), ...(excludeId && { NOT: { id: excludeId } }) },
      select: { name: true },
    });
    if (existing) {
      throw conflictError('Data sudah ada', [
        { field: 'date', messages: [`Tanggal ${date} sudah terdaftar sebagai "${existing.name}"`] },
      ]);
    }
  }
}
