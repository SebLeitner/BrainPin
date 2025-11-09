const DEFAULT_COUNTRY_CODE = "+49";

export const isTelephoneUrl = (value: string): boolean => {
  return value.trim().toLowerCase().startsWith("tel:");
};

export const extractPhoneNumber = (value: string): string => {
  if (!isTelephoneUrl(value)) {
    return value;
  }

  return value.replace(/^tel:/i, "");
};

export type PhoneSanitizeResult = {
  normalized: string;
  hasChanged: boolean;
};

const stripFormattingCharacters = (value: string): string => {
  return value.replace(/[\s()./\-]/g, "");
};

export const sanitizePhoneNumber = (value: string): PhoneSanitizeResult => {
  const trimmed = value.trim();
  let normalized = stripFormattingCharacters(trimmed);

  if (!normalized) {
    throw new Error("Bitte gib eine Telefonnummer an.");
  }

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  const plusCount = normalized.split("+").length - 1;

  if (plusCount > 1) {
    throw new Error("Ungültige Telefonnummer. Es darf nur ein + enthalten sein.");
  }

  if (plusCount === 1 && !normalized.startsWith("+")) {
    throw new Error("Ungültige Telefonnummer. Ein + ist nur am Anfang erlaubt.");
  }

  const rawDigits = normalized.startsWith("+")
    ? normalized.slice(1)
    : normalized;

  if (!/^\d+$/.test(rawDigits)) {
    throw new Error(
      "Ungültige Telefonnummer. Erlaubt sind nur Ziffern sowie ein optionales + am Anfang."
    );
  }

  let finalNumber: string;

  if (normalized.startsWith("+")) {
    if (rawDigits.length === 0) {
      throw new Error("Bitte gib eine Telefonnummer an.");
    }

    finalNumber = `+${rawDigits}`;
  } else {
    const withoutLeadingZero = rawDigits.replace(/^0+/, "");

    if (!withoutLeadingZero) {
      throw new Error(
        "Ungültige Telefonnummer. Entferne führende Nullen oder gib eine Vorwahl an."
      );
    }

    finalNumber = `${DEFAULT_COUNTRY_CODE}${withoutLeadingZero}`;
  }

  return {
    normalized: finalNumber,
    hasChanged: finalNumber !== trimmed
  };
};

export const validateHttpUrl = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Bitte gib eine URL an.");
  }

  try {
    const candidate = new URL(trimmed);
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Ungültige URL. Bitte gib eine vollständige Adresse mit http:// oder https:// an."
    );
  }

  return trimmed;
};
