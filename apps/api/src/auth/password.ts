import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Política mínima: 10+ caracteres com letras e números. */
export function passwordPolicyError(plain: string): string | null {
  if (plain.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) return "A senha deve conter letras e números.";
  return null;
}
