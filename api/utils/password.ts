/** 统一的密码强度规则：至少 8 位，且同时包含字母和数字。 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return '密码长度至少为8位。';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return '密码必须同时包含至少一个英文字母和一个数字。';
  }
  return null;
}
