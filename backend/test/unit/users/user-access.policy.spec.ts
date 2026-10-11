import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { AuthUser } from '@/common/types/auth-user.type';
import { assertCanAssignRole, assertCanManageUser } from '@/modules/users/user-access.policy';

const superAdmin: AuthUser = { id: 'sa', email: 'sa@x.id', role: Role.SUPER_ADMIN };
const admin: AuthUser = { id: 'adm', email: 'adm@x.id', role: Role.ADMIN };
const employee: AuthUser = { id: 'emp', email: 'emp@x.id', role: Role.EMPLOYEE };

const target = (id: string, role: Role) => ({ id, role });

function expectForbidden(run: () => void) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).code).toBe(ErrorCode.FORBIDDEN);
    expect((error as BusinessException).getStatus()).toBe(403);
    return;
  }
  throw new Error('Seharusnya FORBIDDEN');
}

describe('user-access.policy', () => {
  describe('assertCanAssignRole', () => {
    it.each([Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE])(
      'SUPER_ADMIN boleh memberi role %s',
      (role) => {
        expect(() => assertCanAssignRole(superAdmin, role)).not.toThrow();
      },
    );

    it('ADMIN hanya boleh memberi role EMPLOYEE', () => {
      expect(() => assertCanAssignRole(admin, Role.EMPLOYEE)).not.toThrow();
      expectForbidden(() => assertCanAssignRole(admin, Role.ADMIN));
      expectForbidden(() => assertCanAssignRole(admin, Role.SUPER_ADMIN));
    });

    it('EMPLOYEE tidak boleh memberi role apa pun', () => {
      expectForbidden(() => assertCanAssignRole(employee, Role.EMPLOYEE));
    });
  });

  describe('assertCanManageUser', () => {
    it('SUPER_ADMIN boleh mengelola ADMIN & EMPLOYEE lain', () => {
      expect(() => assertCanManageUser(superAdmin, target('a2', Role.ADMIN))).not.toThrow();
      expect(() => assertCanManageUser(superAdmin, target('e2', Role.EMPLOYEE))).not.toThrow();
      expect(() => assertCanManageUser(superAdmin, target('sa2', Role.SUPER_ADMIN))).not.toThrow();
    });

    it('ADMIN boleh mengelola EMPLOYEE, tidak boleh ADMIN/SUPER_ADMIN', () => {
      expect(() => assertCanManageUser(admin, target('e2', Role.EMPLOYEE))).not.toThrow();
      expectForbidden(() => assertCanManageUser(admin, target('a2', Role.ADMIN)));
      expectForbidden(() => assertCanManageUser(admin, target('sa2', Role.SUPER_ADMIN)));
    });

    it('tidak ada yang boleh mengelola akunnya sendiri (nonaktif/hapus/reset)', () => {
      expectForbidden(() => assertCanManageUser(superAdmin, target('sa', Role.SUPER_ADMIN)));
      expectForbidden(() => assertCanManageUser(admin, target('adm', Role.ADMIN)));
    });

    it('allowSelf: SUPER_ADMIN boleh mengubah datanya sendiri; ADMIN tetap tidak (pakai /users/me)', () => {
      expect(() =>
        assertCanManageUser(superAdmin, target('sa', Role.SUPER_ADMIN), { allowSelf: true }),
      ).not.toThrow();
      expectForbidden(() =>
        assertCanManageUser(admin, target('adm', Role.ADMIN), { allowSelf: true }),
      );
    });

    it('EMPLOYEE tidak boleh mengelola siapa pun', () => {
      expectForbidden(() => assertCanManageUser(employee, target('e2', Role.EMPLOYEE)));
    });
  });
});
