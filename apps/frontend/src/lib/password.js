// Same minimum as the backend DTOs (ChangePasswordDto / ResetPasswordDto).
export const MIN_PASSWORD_LENGTH = 8

export function passwordChecks(password = "", confirmation = "") {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    mix: /[a-z]/.test(password) && /[A-Z]/.test(password),
    symbol: /[^A-Za-z]/.test(password),
    match: password.length > 0 && password === confirmation,
  }
}

/** 0 = empty, 1 = weak, 2 = medium, 3 = strong. */
export function passwordStrength(password = "") {
  if (!password) return 0
  const { length, mix, symbol } = passwordChecks(password)
  if (!length) return 1
  const extras = Number(mix) + Number(symbol) + Number(password.length >= 12)
  return extras >= 2 ? 3 : extras === 1 ? 2 : 1
}
