/**
 * Canonical phone number normalization and formatting utilities for Awedadari.
 *
 * Primary focus: Ethiopia (+251) mobile numbers (09xx, 07xx), while cleanly
 * supporting international formats.
 */

/**
 * Normalizes any valid user input into ONE canonical E.164-like representation.
 * Examples:
 *   "0912345678" -> "+251912345678"
 *   "0712345678" -> "+251712345678"
 *   "912345678"  -> "+251912345678"
 *   "+251 912-345-678" -> "+251912345678"
 *   "251912345678" -> "+251912345678"
 *   "+1 415 555 2671" -> "+14155552671"
 */
export function normalizePhoneNumber(rawInput?: string | null): string {
  if (!rawInput) return '';

  let cleaned = rawInput.trim();
  if (!cleaned) return '';

  // Remove parentheses, dashes, dots, and spaces
  cleaned = cleaned.replace(/[\s\-().]/g, '');

  // Handle leading 00 as international prefix
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If already starts with +
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1).replace(/\D/g, '');
    return '+' + digitsOnly;
  }

  // Only digits remain
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // Ethiopian 10-digit formats starting with 09 or 07
  if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) {
    return `+251${digits.slice(1)}`;
  }

  // Ethiopian 9-digit formats starting with 9 or 7
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
    return `+251${digits}`;
  }

  // Ethiopian 12-digit format starting with 251
  if (digits.length === 12 && digits.startsWith('251')) {
    return `+${digits}`;
  }

  // If generic international or local number without +
  return digits.length >= 7 ? `+${digits}` : digits;
}

/**
 * Validates whether the given string resolves to a plausible phone number.
 */
export function isValidPhoneNumber(rawInput?: string | null): boolean {
  if (!rawInput) return false;
  const normalized = normalizePhoneNumber(rawInput);
  // Canonical phone should start with + and have between 8 and 16 digits
  return /^\+\d{8,15}$/.test(normalized);
}

/**
 * Returns a human-friendly display format.
 * For Ethiopian numbers:
 *   "+251912345678" -> "0912 345 678" (or "+251 912 345 678")
 */
export function formatPhoneDisplay(rawInput?: string | null, preferLocal = true): string {
  if (!rawInput) return '';
  const normalized = normalizePhoneNumber(rawInput);
  if (!normalized) return rawInput || '';

  // Check Ethiopian +251 9xx or +251 7xx
  const ethiopianMatch = normalized.match(/^\+251([97]\d)(\d{3})(\d{4})$/);
  if (ethiopianMatch) {
    const [, prefix, mid, end] = ethiopianMatch;
    if (preferLocal) {
      return `0${prefix} ${mid} ${end}`;
    }
    return `+251 ${prefix} ${mid} ${end}`;
  }

  return normalized;
}
