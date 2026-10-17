import { describe, expect, it } from 'vitest';
import { importRowErrors } from './api';
import { validateImportFile } from './components/import-dialog';
import {
  assignableRoles,
  canManage,
  emptyEmployeeForm,
  employeeFormSchema,
  toEmployeePayload,
} from './schemas';

describe('hak role', () => {
  it('ADMIN hanya boleh memberi role Karyawan; SUPER_ADMIN semua', () => {
    expect(assignableRoles('ADMIN')).toEqual(['EMPLOYEE']);
    expect(assignableRoles('SUPER_ADMIN')).toEqual(['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']);
    expect(assignableRoles('EMPLOYEE')).toEqual([]);
  });

  it('ADMIN tidak boleh mengelola ADMIN/SUPER_ADMIN lain', () => {
    expect(canManage('ADMIN', { role: 'EMPLOYEE' })).toBe(true);
    expect(canManage('ADMIN', { role: 'ADMIN' })).toBe(false);
    expect(canManage('ADMIN', { role: 'SUPER_ADMIN' })).toBe(false);
    expect(canManage('SUPER_ADMIN', { role: 'ADMIN' })).toBe(true);
  });
});

describe('employeeFormSchema', () => {
  const valid = {
    ...emptyEmployeeForm(),
    employeeCode: ' emp-099 ',
    name: 'Rina Putri',
    email: ' Rina@Kantor.ID ',
    phone: '0812-3456-7890',
  };

  it('tambah: password wajib memenuhi kebijakan', () => {
    const missing = employeeFormSchema('create').safeParse({ ...valid, password: 'lemah' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['password']);
    expect(
      employeeFormSchema('create').safeParse({ ...valid, password: 'Rahasia123' }).success,
    ).toBe(true);
  });

  it('ubah: password tidak divalidasi; nilai dinormalisasi seperti backend', () => {
    const result = employeeFormSchema('update').safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      employeeCode: 'EMP-099',
      email: 'rina@kantor.id',
      phone: '081234567890',
    });
    expect(toEmployeePayload(result.data!)).toMatchObject({ position: null, departmentId: null });
  });

  it('NIP & telepon tidak valid ditolak', () => {
    const result = employeeFormSchema('update').safeParse({
      ...valid,
      employeeCode: 'EMP 01',
      phone: '123',
    });
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'employeeCode',
      'phone',
    ]);
  });
});

describe('import XLSX', () => {
  it('validasi file sebelum upload', () => {
    expect(validateImportFile({ name: 'karyawan.xlsx', size: 1000, type: '' })).toBeNull();
    expect(validateImportFile({ name: 'karyawan.csv', size: 1000, type: 'text/csv' })).toMatch(
      /\.xlsx/,
    );
    expect(validateImportFile({ name: 'besar.xlsx', size: 6 * 1024 * 1024, type: '' })).toMatch(
      /maksimal 5 MB/,
    );
  });

  it('error per baris diurutkan & bentuk lain diabaikan', () => {
    expect(
      importRowErrors([
        { row: 5, field: 'email', messages: ['Email sudah dipakai'] },
        { row: 2, field: 'employeeCode', messages: ['NIP wajib diisi'] },
        { field: 'file', messages: ['x'] },
        'rusak',
      ]),
    ).toEqual([
      { row: 2, field: 'employeeCode', messages: ['NIP wajib diisi'] },
      { row: 5, field: 'email', messages: ['Email sudah dipakai'] },
    ]);
    expect(importRowErrors(null)).toEqual([]);
  });
});
