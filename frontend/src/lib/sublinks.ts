export const isTelephoneUrl = (value: string): boolean => {
  return value.trim().toLowerCase().startsWith("tel:");
};

export const extractPhoneNumber = (value: string): string => {
  if (!isTelephoneUrl(value)) {
    return value;
  }

  return value.replace(/^tel:/i, "");
};

export const sanitizePhoneNumber = (value: string): string => {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[\s()./\-]/g, "");

  if (!normalized) {
    throw new Error("Bitte gib eine Telefonnummer an.");
  }

  if (!/^\+?\d+$/.test(normalized)) {
    throw new Error(
      "Ungültige Telefonnummer. Erlaubt sind nur Ziffern sowie ein optionales + am Anfang."
    );
  }

  if (normalized.startsWith("+") && normalized.indexOf("+", 1) !== -1) {
    throw new Error("Ungültige Telefonnummer. Es darf nur ein + enthalten sein.");
  }

  return normalized;
};
