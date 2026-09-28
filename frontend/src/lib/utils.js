import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Validate Indonesian NPWP (Tax ID)
 * Format: XX.XXX.XXX.X-XXX.XXX (15 digits)
 */
export function validateNPWP(npwp) {
  if (!npwp) return { valid: false, message: "NPWP wajib diisi." };
  const digits = npwp.replace(/\D/g, "");
  if (digits.length !== 15) {
    return { valid: false, message: "NPWP harus 15 digit." };
  }
  return { valid: true, message: "" };
}

/**
 * Format NPWP with dashes and dots: XX.XXX.XXX.X-XXX.XXX
 */
export function formatNPWP(value) {
  const d = value.replace(/\D/g, "").slice(0, 15);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 9) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}.${d.slice(8)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}.${d.slice(8,9)}-${d.slice(9)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}.${d.slice(8,9)}-${d.slice(9,12)}.${d.slice(12)}`;
}
