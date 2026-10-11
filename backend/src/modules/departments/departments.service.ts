import { Injectable } from '@nestjs/common';
import { conflictError, notFoundError } from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  type CreateDepartmentDto,
  DEPARTMENT_SORT_FIELDS,
  type DepartmentQueryDto,
  type UpdateDepartmentDto,
} from './dto/department.dto';

const DEPARTMENT_SELECT = {
  id: true,
  code: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: { where: { deletedAt: null } } } },
} satisfies Prisma.DepartmentSelect;

type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof DEPARTMENT_SELECT }>;

export type DepartmentView = Omit<DepartmentRow, '_count'> & { userCount: number };

const toView = ({ _count, ...department }: DepartmentRow): DepartmentView => ({
  ...department,
  userCount: _count.users,
});

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: DepartmentQueryDto): Promise<PaginatedResult<DepartmentView>> {
    const where: Prisma.DepartmentWhereInput = query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {};
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, DEPARTMENT_SORT_FIELDS, 'code');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        orderBy,
        select: DEPARTMENT_SELECT,
        ...toSkipTake(query),
      }),
      this.prisma.department.count({ where }),
    ]);
    return paginate(rows.map(toView), total, query);
  }

  async findOne(id: string): Promise<DepartmentView> {
    const row = await this.prisma.department.findUnique({
      where: { id },
      select: DEPARTMENT_SELECT,
    });
    if (!row) throw notFoundError('Departemen tidak ditemukan');
    return toView(row);
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentView> {
    await this.assertUnique(dto);
    const row = await this.prisma.department.create({ data: dto, select: DEPARTMENT_SELECT });
    return toView(row);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentView> {
    await this.findOne(id);
    await this.assertUnique(dto, id);
    const row = await this.prisma.department.update({
      where: { id },
      data: dto,
      select: DEPARTMENT_SELECT,
    });
    return toView(row);
  }

  /** Ditolak (409) bila masih ada karyawan aktif; karyawan nonaktif dilepas (SetNull). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const activeUsers = await this.prisma.user.count({
      where: { departmentId: id, deletedAt: null, isActive: true },
    });
    if (activeUsers > 0) {
      throw conflictError(`Departemen masih memiliki ${activeUsers} karyawan aktif`);
    }
    await this.prisma.department.delete({ where: { id } });
  }

  private async assertUnique(dto: UpdateDepartmentDto, excludeId?: string): Promise<void> {
    const or: Prisma.DepartmentWhereInput[] = [];
    if (dto.code) or.push({ code: dto.code });
    if (dto.name) or.push({ name: dto.name });
    if (or.length === 0) return;

    const existing = await this.prisma.department.findMany({
      where: { OR: or, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { code: true, name: true },
    });
    const details = [];
    if (dto.code && existing.some((d) => d.code === dto.code)) {
      details.push({ field: 'code', messages: ['Kode departemen sudah digunakan'] });
    }
    if (dto.name && existing.some((d) => d.name.toLowerCase() === dto.name?.toLowerCase())) {
      details.push({ field: 'name', messages: ['Nama departemen sudah digunakan'] });
    }
    if (details.length > 0) throw conflictError('Data sudah ada', details);
  }
}
