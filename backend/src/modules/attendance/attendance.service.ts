import { Injectable } from '@nestjs/common';
import { ClockService } from '@/common/clock/clock.service';
import { ErrorCode } from '@/common/constants/error-codes';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { notFoundError } from '@/common/exceptions/error-factories';
import { isPrismaKnownRequestError } from '@/common/filters/all-exceptions.filter';
import type { AuthUser } from '@/common/types/auth-user.type';
import { formatLocalTime, fromDbDate, toDbDate, toTzDateString } from '@/common/utils/date.util';
import { AppConfigService } from '@/config/app.config';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { parseQrToken } from '@/modules/qr/qr-token';
import { QrService } from '@/modules/qr/qr.service';
import { SettingsService } from '@/modules/settings/settings.service';
import {
  AttendanceContextLoader,
  type AttendanceContext,
  type ContextUser,
} from './attendance-context.loader';
import { AttendanceRulesService, type ShiftRule } from './attendance-rules.service';
import {
  ATTENDANCE_SELECT,
  type AttendanceRow,
  type AttendanceView,
  toAttendanceView,
} from './attendance.view';
import { type DeviceBindingResult, DeviceBindingService } from './device-binding.service';
import type { PersonalScanDto, ScanKioskDto } from './dto/scan.dto';
import { GeofenceService } from './geofence.service';
import { type ScanLogEntry, ScanLogService } from './scan-log.service';

export interface ScanResult {
  type: 'CHECK_IN' | 'CHECK_OUT';
  attendance: AttendanceView;
  message: string;
  user: { name: string; employeeCode: string };
}

export interface MyTodayStatus {
  date: string;
  serverTime: Date;
  attendance: AttendanceView | null;
  shift: (ShiftRule & { id: string }) | null;
  isWorkingDay: boolean;
  holiday: { id: string; date: string; name: string } | null;
  leave: { id: string; type: string; startDate: string; endDate: string } | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInOpensAt: Date | null;
  checkInClosesAt: Date | null;
  checkOutAvailableAt: Date | null;
}

/** Rencana penyimpanan hasil validasi langkah 6–8. */
type ScanPlan =
  | { action: 'CHECK_IN'; user: ContextUser; shift: ShiftRule }
  | {
      action: 'CHECK_OUT';
      user: ContextUser;
      shift: ShiftRule;
      attendance: AttendanceRow & { checkInAt: Date };
    };

interface ScanSource {
  method: 'KIOSK_QR' | 'PERSONAL_QR';
  kioskId: string | null;
  locationId: string;
  latitude: number;
  longitude: number;
  scannedById: string | null;
}

const LEAVE_LABELS: Record<string, string> = { SICK: 'sakit', PERMIT: 'izin', ANNUAL: 'cuti' };

const toDecimal = (value: number) => value.toFixed(7);

/**
 * Orkestrator scan absensi. Urutan validasi WAJIB sesuai BUSINESS-RULES §7:
 * 1 user aktif → 2 token QR → 3 kiosk/lokasi aktif → 4 device binding → 5 geofence
 * → 6 shift → 7 hari kerja/libur/cuti → 8 masuk/pulang + jendela waktu → 9 simpan (transaksi).
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfigService,
    private readonly settings: SettingsService,
    private readonly qr: QrService,
    private readonly rules: AttendanceRulesService,
    private readonly context: AttendanceContextLoader,
    private readonly geofence: GeofenceService,
    private readonly deviceBinding: DeviceBindingService,
    private readonly scanLogs: ScanLogService,
    private readonly audit: AuditLogsService,
  ) {}

  async scanKiosk(actor: AuthUser, dto: ScanKioskDto, client: ClientInfo): Promise<ScanResult> {
    const now = this.clock.now();
    const log: ScanLogEntry = {
      userId: actor.id,
      scanType: 'KIOSK',
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      deviceId: dto.deviceId,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      createdAt: now,
    };

    try {
      const ctx = await this.context.load(actor.id, toTzDateString(now));
      const user = this.assertUserActive(ctx.user); // 1

      const { kiosk } = await this.qr.verifyKioskToken(dto.qrToken, now); // 2–3
      log.kioskId = kiosk.id;

      const [bindingEnabled, geofenceEnabled, minGap] = await Promise.all([
        this.settings.get('attendance.deviceBindingEnabled'),
        this.settings.get('attendance.geofenceEnabled'),
        this.settings.get('attendance.minCheckoutGapMinutes'),
      ]);
      const binding = this.deviceBinding.assertOrBind(user, dto.deviceId, bindingEnabled); // 4
      // Jarak dicatat lebih dulu agar tetap tersimpan di log saat geofence menolak.
      log.distance = this.geofence.distanceMeters(kiosk.location, dto.latitude, dto.longitude);
      this.geofence.assertInside(kiosk.location, dto.latitude, dto.longitude, dto.accuracy, {
        enabled: geofenceEnabled,
        maxAccuracyMeters: this.config.get('GEOFENCE_MAX_ACCURACY_METERS'),
      }); // 5

      const plan = this.plan(ctx, user, now, minGap); // 6–8
      return await this.persist(
        plan,
        ctx,
        now,
        log,
        client,
        {
          method: 'KIOSK_QR',
          kioskId: kiosk.id,
          locationId: kiosk.location.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          scannedById: null,
        },
        { binding, deviceId: dto.deviceId },
      );
    } catch (error) {
      await this.scanLogs.recordFailure({ ...log, errorCode: errorCodeOf(error) });
      throw error;
    }
  }

  /**
   * Mode cadangan (§8): petugas memindai QR personal karyawan. Device binding dilewati;
   * geofence memakai koordinat petugas terhadap lokasi yang dipilih.
   */
  async scanPersonal(
    officer: AuthUser,
    dto: PersonalScanDto,
    client: ClientInfo,
  ): Promise<ScanResult> {
    const now = this.clock.now();
    const log: ScanLogEntry = {
      userId: null,
      scanType: 'PERSONAL',
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      createdAt: now,
    };

    try {
      const token = this.qr.verifyPersonalToken(dto.qrToken, now); // 2 (+ anti-replay)
      log.userId = token.userId;

      const ctx = await this.context.load(token.userId, toTzDateString(now));
      const user = this.assertUserActive(ctx.user); // 1

      const location = await this.prisma.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, latitude: true, longitude: true, radiusMeters: true, isActive: true },
      });
      if (!location) throw notFoundError('Lokasi tidak ditemukan');
      if (!location.isActive) {
        throw new BusinessException(ErrorCode.KIOSK_INACTIVE, 'Lokasi absen tidak aktif');
      } // 3

      const [geofenceEnabled, minGap] = await Promise.all([
        this.settings.get('attendance.geofenceEnabled'),
        this.settings.get('attendance.minCheckoutGapMinutes'),
      ]);
      const point = {
        ...location,
        latitude: location.latitude.toNumber(),
        longitude: location.longitude.toNumber(),
      };
      log.distance = this.geofence.distanceMeters(point, dto.latitude, dto.longitude);
      this.geofence.assertInside(point, dto.latitude, dto.longitude, dto.accuracy, {
        enabled: geofenceEnabled,
        maxAccuracyMeters: this.config.get('GEOFENCE_MAX_ACCURACY_METERS'),
      }); // 5

      const plan = this.plan(ctx, user, now, minGap); // 6–8
      const result = await this.persist(plan, ctx, now, log, client, {
        method: 'PERSONAL_QR',
        kioskId: null,
        locationId: location.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        scannedById: officer.id,
      });
      this.qr.markPersonalTokenUsed(token.userId, token.window, now);
      return result;
    } catch (error) {
      // QR_ALREADY_USED dilempar setelah signature terverifikasi → pemilik token dapat dipercaya.
      // (QR_INVALID/QR_EXPIRED tidak: id di token belum tentu asli.)
      if (
        !log.userId &&
        error instanceof BusinessException &&
        error.code === ErrorCode.QR_ALREADY_USED
      ) {
        log.userId = parseQrToken(dto.qrToken, 'P')?.subjectId ?? null;
      }
      await this.scanLogs.recordFailure({ ...log, errorCode: errorCodeOf(error) });
      throw error;
    }
  }

  /** Kartu beranda karyawan: status hari ini + boleh masuk/pulang sekarang. */
  async getMyToday(userId: string): Promise<MyTodayStatus> {
    const now = this.clock.now();
    const ctx = await this.context.load(userId, toTzDateString(now));
    const shift = ctx.user?.shift?.isActive ? ctx.user.shift : null;
    const minGap = await this.settings.get('attendance.minCheckoutGapMinutes');

    const isWorkingDay = shift ? this.rules.isWorkingDay(shift, ctx.date) : false;
    const window = shift ? this.rules.checkInWindow(shift, ctx.date) : null;
    const action = this.rules.resolveAction(ctx.attendance);
    const checkInAt = ctx.attendance?.checkInAt ?? null;
    const checkOutAvailableAt =
      action === 'CHECK_OUT' && checkInAt
        ? this.rules.checkOutAvailableAt(checkInAt, minGap)
        : null;

    const canScanToday =
      Boolean(ctx.user?.isActive && !ctx.user.deletedAt) &&
      isWorkingDay &&
      !ctx.holiday &&
      !ctx.leave;

    return {
      date: ctx.date,
      serverTime: now,
      attendance: ctx.attendance ? toAttendanceView(ctx.attendance) : null,
      shift: shift
        ? {
            id: shift.id,
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            lateToleranceMinutes: shift.lateToleranceMinutes,
            checkInOpenMinutes: shift.checkInOpenMinutes,
            workDays: shift.workDays,
          }
        : null,
      isWorkingDay,
      holiday: ctx.holiday
        ? { id: ctx.holiday.id, date: fromDbDate(ctx.holiday.date), name: ctx.holiday.name }
        : null,
      leave: ctx.leave
        ? {
            id: ctx.leave.id,
            type: ctx.leave.type,
            startDate: fromDbDate(ctx.leave.startDate),
            endDate: fromDbDate(ctx.leave.endDate),
          }
        : null,
      canCheckIn:
        canScanToday &&
        action === 'CHECK_IN' &&
        shift !== null &&
        this.rules.isWithinCheckInWindow(shift, ctx.date, now),
      canCheckOut: canScanToday && checkOutAvailableAt !== null && now >= checkOutAvailableAt,
      checkInOpensAt: window?.opensAt ?? null,
      checkInClosesAt: window?.closesAt ?? null,
      checkOutAvailableAt,
    };
  }

  // ------------------------------------------------------------------------

  private assertUserActive(user: ContextUser | null): ContextUser {
    if (!user || !user.isActive || user.deletedAt) {
      throw new BusinessException(ErrorCode.ACCOUNT_INACTIVE);
    }
    return user;
  }

  /** Langkah 6–8: shift → hari kerja/libur/cuti → masuk atau pulang + jendela waktu. */
  private plan(
    ctx: AttendanceContext,
    user: ContextUser,
    now: Date,
    minGapMinutes: number,
  ): ScanPlan {
    const shift = user.shift;
    if (!shift?.isActive) throw new BusinessException(ErrorCode.NO_SHIFT_ASSIGNED);

    if (!this.rules.isWorkingDay(shift, ctx.date)) {
      throw new BusinessException(ErrorCode.NOT_WORKING_DAY);
    }
    if (ctx.holiday) {
      throw new BusinessException(
        ErrorCode.HOLIDAY,
        `Hari ini hari libur: ${ctx.holiday.name}`,
        undefined,
        {
          holiday: { date: fromDbDate(ctx.holiday.date), name: ctx.holiday.name },
        },
      );
    }
    if (ctx.leave) {
      throw new BusinessException(
        ErrorCode.ON_LEAVE,
        `Anda sedang ${LEAVE_LABELS[ctx.leave.type] ?? 'izin'} hari ini`,
        undefined,
        { leaveType: ctx.leave.type },
      );
    }

    const action = this.rules.resolveAction(ctx.attendance);
    if (action === 'ALREADY_CHECKED_OUT') {
      throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT, undefined, undefined, {
        checkOutAt: ctx.attendance?.checkOutAt,
      });
    }

    if (action === 'CHECK_IN') {
      const state = this.rules.checkInWindowState(shift, ctx.date, now);
      const window = this.rules.checkInWindow(shift, ctx.date);
      if (state === 'NOT_YET_OPEN') {
        throw new BusinessException(
          ErrorCode.CHECKIN_WINDOW_CLOSED,
          `Absen masuk baru dibuka pukul ${formatLocalTime(window.opensAt)}`,
          undefined,
          { opensAt: window.opensAt },
        );
      }
      if (state === 'CLOSED') {
        throw new BusinessException(
          ErrorCode.CHECKIN_WINDOW_CLOSED,
          `Jam absen masuk sudah berakhir pukul ${shift.endTime}`,
          undefined,
          { closedAt: window.closesAt },
        );
      }
      return { action, user, shift };
    }

    const attendance = ctx.attendance as AttendanceRow & { checkInAt: Date };
    const availableAt = this.rules.checkOutAvailableAt(attendance.checkInAt, minGapMinutes);
    if (now < availableAt) {
      const minutesLeft = Math.ceil((availableAt.getTime() - now.getTime()) / 60_000);
      throw new BusinessException(
        ErrorCode.CHECKOUT_TOO_SOON,
        `Absen pulang baru bisa dilakukan ${minutesLeft} menit lagi (pukul ${formatLocalTime(availableAt)})`,
        undefined,
        { minutesLeft, availableAt },
      );
    }
    // Aturan pulang memakai snapshot saat check-in agar perubahan shift tidak mengubah histori.
    return { action, user, shift: snapshotOf(attendance, shift), attendance };
  }

  /** Langkah 9: simpan absensi + log scan (+ device binding) dalam satu transaksi. */
  private async persist(
    plan: ScanPlan,
    ctx: AttendanceContext,
    now: Date,
    log: ScanLogEntry,
    client: ClientInfo,
    source: ScanSource,
    device?: { binding: DeviceBindingResult; deviceId: string },
  ): Promise<ScanResult> {
    try {
      const { saved: row, message } = await this.prisma.$transaction(async (tx) => {
        let saved: AttendanceRow;
        let message: string;

        if (plan.action === 'CHECK_IN') {
          const status = this.rules.computeCheckInStatus(plan.shift, ctx.date, now);
          message = this.rules.checkInMessage(now, status);
          const data = {
            status: status.status,
            lateMinutes: status.lateMinutes,
            checkInAt: now,
            checkInMethod: source.method,
            checkInLat: toDecimal(source.latitude),
            checkInLng: toDecimal(source.longitude),
            shiftSnapshot: {
              name: plan.shift.name,
              startTime: plan.shift.startTime,
              endTime: plan.shift.endTime,
              lateToleranceMinutes: plan.shift.lateToleranceMinutes,
            },
            kioskId: source.kioskId,
            locationId: source.locationId,
            scannedById: source.scannedById,
          } satisfies Prisma.AttendanceUncheckedUpdateInput;

          // Record tanpa check-in (mis. ABSENT buatan admin) dilengkapi, bukan dibuat ulang.
          saved = ctx.attendance
            ? await tx.attendance.update({
                where: { id: ctx.attendance.id },
                data,
                select: ATTENDANCE_SELECT,
              })
            : await tx.attendance.create({
                data: { ...data, userId: plan.user.id, date: toDbDate(ctx.date) },
                select: ATTENDANCE_SELECT,
              });
        } else {
          const metrics = this.rules.computeCheckOutMetrics(
            plan.shift,
            ctx.date,
            plan.attendance.checkInAt,
            now,
          );
          message = this.rules.checkOutMessage(now, metrics);
          // `checkOutAt: null` mencegah dua scan pulang bersamaan.
          const { count } = await tx.attendance.updateMany({
            where: { id: plan.attendance.id, checkOutAt: null },
            data: {
              checkOutAt: now,
              checkOutMethod: source.method,
              checkOutLat: toDecimal(source.latitude),
              checkOutLng: toDecimal(source.longitude),
              earlyLeaveMinutes: metrics.earlyLeaveMinutes,
              workMinutes: metrics.workMinutes,
              ...(source.scannedById && { scannedById: source.scannedById }),
            },
          });
          if (count === 0) throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT);
          saved = await tx.attendance.findUniqueOrThrow({
            where: { id: plan.attendance.id },
            select: ATTENDANCE_SELECT,
          });
        }

        if (device?.binding === 'BIND') {
          const { count } = await tx.user.updateMany({
            where: { id: plan.user.id, boundDeviceId: null },
            data: { boundDeviceId: device.deviceId },
          });
          if (count === 0) throw new BusinessException(ErrorCode.DEVICE_MISMATCH);
          await this.audit.log(
            {
              actorId: plan.user.id,
              action: AuditAction.DEVICE_BOUND,
              entity: 'User',
              entityId: plan.user.id,
              metadata: { deviceId: device.deviceId },
              ip: client.ipAddress,
              userAgent: client.userAgent,
            },
            tx,
          );
        }

        await this.scanLogs.recordSuccess(log, tx);
        return { saved, message };
      });

      return {
        type: plan.action,
        attendance: toAttendanceView(row),
        message,
        user: { name: plan.user.name, employeeCode: plan.user.employeeCode },
      };
    } catch (error) {
      // Dua scan bersamaan untuk user & tanggal yang sama: InnoDB melaporkan duplikat unik
      // (P2002) atau deadlock/write conflict (P2034) — keduanya berarti scan ini duplikat.
      if (isPrismaKnownRequestError(error) && (error.code === 'P2002' || error.code === 'P2034')) {
        throw new BusinessException(
          plan.action === 'CHECK_IN' ? ErrorCode.ALREADY_CHECKED_IN : ErrorCode.ALREADY_CHECKED_OUT,
        );
      }
      throw error;
    }
  }
}

function errorCodeOf(error: unknown): string {
  return error instanceof BusinessException ? error.code : ErrorCode.INTERNAL_ERROR;
}

/** Aturan shift dari `shiftSnapshot` (fallback ke shift saat ini bila snapshot tidak lengkap). */
function snapshotOf(attendance: AttendanceRow, current: ShiftRule): ShiftRule {
  const snapshot = attendance.shiftSnapshot as Partial<ShiftRule> | null;
  if (
    snapshot &&
    typeof snapshot.startTime === 'string' &&
    typeof snapshot.endTime === 'string' &&
    typeof snapshot.lateToleranceMinutes === 'number'
  ) {
    return {
      ...current,
      name: snapshot.name ?? current.name,
      startTime: snapshot.startTime,
      endTime: snapshot.endTime,
      lateToleranceMinutes: snapshot.lateToleranceMinutes,
    };
  }
  return current;
}
