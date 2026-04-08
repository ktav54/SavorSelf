export function formatFoodName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const withoutAwkwardQualifiers = trimmed
    .replace(/\s*\((without|no|minus)[^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = withoutAwkwardQualifiers.toLowerCase();
  const titleCased = normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());

  return titleCased
    .replace(/\bMcdonald's\b/g, "McDonald's")
    .replace(/\bBbq\b/g, "BBQ")
    .replace(/\bUsda\b/g, "USDA")
    .replace(/\bPb&j\b/g, "PB&J")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bWith\b/g, "with")
    .replace(/\bWithout\b/g, "without")
    .replace(/\bOf\b/g, "of")
    .replace(/\bIn\b/g, "in")
    .replace(/\bOn\b/g, "on")
    .replace(/\bA\b/g, "a")
    .replace(/\bAn\b/g, "an")
    .trim();
}
