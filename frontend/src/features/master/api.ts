import { api } from '@/lib/api-client';
import type {
  Department,
  Holiday,
  Location,
  LocationInput,
  Schemas,
  Shift,
  ShiftInput,
} from '@/types';

/** Parameter daftar berpaginasi (lihat `useListParams`). */
export type ListQuery = Record<string, string | number>;

/** Query key factory master data. `lookup` = daftar ringkas untuk dropdown form. */
export const masterKeys = {
  departments: ['departments'] as const,
  departmentList: (query: ListQuery) => [...masterKeys.departments, 'list', query] as const,
  shifts: ['shifts'] as const,
  shiftList: (query: ListQuery) => [...masterKeys.shifts, 'list', query] as const,
  locations: ['locations'] as const,
  locationList: (query: ListQuery) => [...masterKeys.locations, 'list', query] as const,
  holidays: ['holidays'] as const,
};

/** Ukuran halaman maksimal backend — dipakai untuk daftar pilihan (dropdown). */
export const LOOKUP_QUERY = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' } as const;

export const departmentsApi = {
  list: (query: ListQuery) => api.page<Department>('/departments', query),
  create: (input: Schemas['CreateDepartmentDto']) => api.post<Department>('/departments', input),
  update: (id: string, input: Schemas['UpdateDepartmentDto']) =>
    api.patch<Department>(`/departments/${id}`, input),
  remove: (id: string) => api.delete<null>(`/departments/${id}`),
};

export const shiftsApi = {
  list: (query: ListQuery) => api.page<Shift>('/shifts', query),
  create: (input: ShiftInput) => api.post<Shift>('/shifts', input),
  update: (id: string, input: Partial<ShiftInput>) => api.patch<Shift>(`/shifts/${id}`, input),
  remove: (id: string) => api.delete<null>(`/shifts/${id}`),
};

export const locationsApi = {
  list: (query: ListQuery) => api.page<Location>('/locations', query),
  create: (input: LocationInput) => api.post<Location>('/locations', input),
  update: (id: string, input: Partial<LocationInput>) =>
    api.patch<Location>(`/locations/${id}`, input),
  remove: (id: string) => api.delete<null>(`/locations/${id}`),
};

export const holidaysAdminApi = {
  create: (input: Schemas['CreateHolidayDto']) => api.post<Holiday>('/holidays', input),
  bulk: (items: Schemas['CreateHolidayDto'][]) =>
    api.post<Schemas['BulkHolidayResultEntity']>('/holidays/bulk', { items }),
  update: (id: string, input: Schemas['UpdateHolidayDto']) =>
    api.patch<Holiday>(`/holidays/${id}`, input),
  remove: (id: string) => api.delete<null>(`/holidays/${id}`),
};
