import type { components } from './api';

/** Alias tipe dari skema OpenAPI backend (`npm run gen:api`). */
export type Schemas = components['schemas'];

export type UserProfile = Schemas['UserProfileEntity'];
export type AuthTokenResponse = Schemas['AuthTokenEntity'];
export type PublicSettings = Schemas['PublicSettingsEntity'];
export type Attendance = Schemas['AttendanceEntity'];
export type MyToday = Schemas['MyTodayEntity'];
export type TodayShift = Schemas['TodayShiftEntity'];
export type MonthlyAttendance = Schemas['MonthlyAttendanceEntity'];
export type MonthlySummary = Schemas['MonthlySummaryEntity'];
export type Holiday = Schemas['HolidayEntity'];
export type AttendanceMethod = NonNullable<Attendance['checkInMethod']>;
export type ScanResult = Schemas['ScanResultEntity'];
export type ScanKioskInput = Schemas['ScanKioskDto'];
export type PersonalQr = Schemas['PersonalQrEntity'];
export type LeaveRequest = Schemas['LeaveRequestEntity'];
export type LeaveQuota = Schemas['LeaveQuotaEntity'];
export type ProfileShift = Schemas['ProfileShiftEntity'];
export type Kiosk = Schemas['KioskEntity'];
export type KioskQr = Schemas['KioskQrEntity'];
export type RecentScan = Schemas['RecentScanEntity'];
export type User = Schemas['UserEntity'];
export type CreateUserInput = Schemas['CreateUserDto'];
export type UpdateUserInput = Schemas['UpdateUserDto'];
export type Department = Schemas['DepartmentEntity'];
export type Shift = Schemas['ShiftEntity'];
export type ShiftInput = Schemas['CreateShiftDto'];
export type Location = Schemas['LocationEntity'];
export type LocationInput = Schemas['CreateLocationDto'];
export type KioskInput = Schemas['CreateKioskDto'];
export type Settings = Schemas['SettingsEntity'];
export type DashboardSummary = Schemas['DashboardSummaryEntity'];
export type TrendPoint = Schemas['TrendPointEntity'];
export type LateRanking = Schemas['LateRankingEntity'];
export type RecentActivity = Schemas['RecentActivityEntity'];
export type AttendanceListItem = Schemas['AttendanceListItemEntity'];
export type LeaveType = Schemas['TodayLeaveEntity']['type'];
export type Role = UserProfile['role'];

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'SICK' | 'PERMIT' | 'LEAVE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
