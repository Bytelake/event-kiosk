function formatFlattenedValidationError(error: {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}): string {
  const parts = [
    ...(error.formErrors ?? []),
    ...Object.entries(error.fieldErrors ?? {}).flatMap(([field, messages]) =>
      (messages ?? []).map((message) => `${field}: ${message}`),
    ),
  ];
  return parts.join(". ") || "Invalid request";
}

export function formatSettingsSaveError(
  status: number,
  body: { error?: unknown },
): string {
  if (status === 401) {
    return "Session expired. Sign in again and retry.";
  }

  const error = body.error;
  if (error && typeof error === "object" && "fieldErrors" in error) {
    return formatFlattenedValidationError(
      error as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      },
    );
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Could not save settings. Check your entries and try again.";
}
