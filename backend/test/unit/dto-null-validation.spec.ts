import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { CorrectAttendanceDto } from '@/modules/attendance/dto/attendance-admin.dto';
import { UpdateDepartmentDto } from '@/modules/departments/dto/department.dto';
import { UpdateHolidayDto } from '@/modules/holidays/dto/holiday.dto';
import { UpdateKioskDto } from '@/modules/kiosks/dto/kiosk.dto';
import { UpdateLocationDto } from '@/modules/locations/dto/location.dto';
import { UpdateSettingsDto } from '@/modules/settings/dto/update-settings.dto';
import { UpdateShiftDto } from '@/modules/shifts/dto/shift.dto';
import { CreateUserDto, UpdateMeDto, UpdateUserDto } from '@/modules/users/dto/user.dto';

/** Sama dengan ValidationPipe global di AppModule. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});

type Dto = new () => object;
const validate = (metatype: Dto, body: object) => pipe.transform(body, { type: 'body', metatype });

/**
 * `null` pada field yang tidak nullable dulu lolos `@IsOptional()` lalu gagal di Prisma (500).
 * Sekarang wajib ditolak 400 VALIDATION_ERROR pada field tersebut.
 */
describe('DTO body: null ditolak pada field non-nullable', () => {
  it.each<[string, Dto, object, string]>([
    ['UpdateUserDto.name', UpdateUserDto, { name: null }, 'name'],
    ['UpdateUserDto.email', UpdateUserDto, { email: null }, 'email'],
    ['UpdateUserDto.employeeCode', UpdateUserDto, { employeeCode: null }, 'employeeCode'],
    ['UpdateUserDto.role', UpdateUserDto, { role: null }, 'role'],
    ['UpdateMeDto.name', UpdateMeDto, { name: null }, 'name'],
    ['UpdateShiftDto.startTime', UpdateShiftDto, { startTime: null }, 'startTime'],
    ['UpdateShiftDto.workDays', UpdateShiftDto, { workDays: null }, 'workDays'],
    ['UpdateLocationDto.latitude', UpdateLocationDto, { latitude: null }, 'latitude'],
    ['UpdateLocationDto.isActive', UpdateLocationDto, { isActive: null }, 'isActive'],
    ['UpdateKioskDto.locationId', UpdateKioskDto, { locationId: null }, 'locationId'],
    ['UpdateKioskDto.isActive', UpdateKioskDto, { isActive: null }, 'isActive'],
    ['UpdateDepartmentDto.name', UpdateDepartmentDto, { name: null }, 'name'],
    ['UpdateHolidayDto.date', UpdateHolidayDto, { date: null }, 'date'],
    ['UpdateSettingsDto.company.name', UpdateSettingsDto, { 'company.name': null }, 'company.name'],
    [
      'UpdateSettingsDto.leave.annualQuota',
      UpdateSettingsDto,
      { 'leave.annualQuota': null },
      'leave.annualQuota',
    ],
    [
      'CorrectAttendanceDto.status',
      CorrectAttendanceDto,
      { status: null, reason: 'x'.repeat(12) },
      'status',
    ],
  ])('%s', async (_label, metatype, body, field) => {
    await expect(validate(metatype, body)).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([expect.objectContaining({ field })]),
      },
    });
  });
});

describe('DTO body: field nullable tetap menerima null', () => {
  it.each<[string, Dto, object]>([
    [
      'UpdateUserDto.phone/position/departmentId/shiftId/locationId',
      UpdateUserDto,
      {
        phone: null,
        position: null,
        departmentId: null,
        shiftId: null,
        locationId: null,
      },
    ],
    ['UpdateMeDto.phone', UpdateMeDto, { phone: null }],
    ['UpdateLocationDto.address', UpdateLocationDto, { address: null }],
    [
      'CorrectAttendanceDto.checkOutAt/note',
      CorrectAttendanceDto,
      {
        checkOutAt: null,
        note: null,
        reason: 'Koreksi sesuai rekaman CCTV',
      },
    ],
  ])('%s', async (_label, metatype, body) => {
    await expect(validate(metatype, body)).resolves.toMatchObject(body);
  });

  it('field opsional boleh tidak dikirim sama sekali', async () => {
    await expect(validate(UpdateUserDto, {})).resolves.toEqual({});
    await expect(validate(UpdateSettingsDto, {})).resolves.toEqual({});
  });

  it('CreateUserDto tanpa role tetap valid (default EMPLOYEE), role null ditolak', async () => {
    const base = {
      employeeCode: 'EMP900',
      name: 'Budi',
      email: 'budi@absenyok.id',
      password: 'Rahasia@123',
    };
    await expect(validate(CreateUserDto, base)).resolves.toMatchObject(base);
    await expect(validate(CreateUserDto, { ...base, role: null })).rejects.toBeDefined();
  });
});
