import { authenticator } from "otplib";
import QRCode from "qrcode";
import { decrypt, encrypt } from "../lib/crypto.js";
import { getDb } from "../db/connection.js";

authenticator.options = { window: 1 };

const ISSUER = "emilIA";

export function beginMfaSetup(userId: string, email: string): { otpauthUrl: string; secret: string } {
  const secret = authenticator.generateSecret();
  getDb().prepare(`UPDATE users SET mfa_secret_enc = ?, mfa_enabled = 0 WHERE id = ?`).run(encrypt(secret), userId);
  return { otpauthUrl: authenticator.keyuri(email, ISSUER, secret), secret };
}

export async function qrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220, color: { dark: "#1D2924", light: "#FFFFFF" } });
}

export function verifyMfaCode(userId: string, code: string): boolean {
  const row = getDb().prepare(`SELECT mfa_secret_enc FROM users WHERE id = ?`).get(userId) as
    | { mfa_secret_enc: string | null }
    | undefined;
  if (!row?.mfa_secret_enc) return false;
  const secret = decrypt(row.mfa_secret_enc);
  return authenticator.check(code.replace(/\s+/g, ""), secret);
}

export function enableMfa(userId: string): void {
  getDb().prepare(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`).run(userId);
}

export function disableMfa(userId: string): void {
  getDb().prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL WHERE id = ?`).run(userId);
}
