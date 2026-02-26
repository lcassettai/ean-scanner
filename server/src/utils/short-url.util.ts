import { randomBytes } from 'crypto';

export function generateShortCode(): string {
  return randomBytes(3).toString('hex'); // 6 caracteres hex
}

export function generateAccessCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
