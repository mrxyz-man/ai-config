export const DEFAULT_UI_LOCALE = "en";
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const UI_LOCALE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  hint: string;
}> = [
  { value: "en", label: "English", hint: "UI content in English" },
  { value: "ru", label: "Russian", hint: "UI content in Russian" },
  { value: "custom", label: "Custom", hint: "Enter custom locale code" }
] as const;

export const normalizeUiLocale = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return LOCALE_PATTERN.test(normalized) ? normalized : null;
};
