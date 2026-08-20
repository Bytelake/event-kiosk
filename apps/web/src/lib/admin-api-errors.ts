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

  if (status >= 500) {
    return "Server error while saving settings. If you recently pulled schema changes, stop the dev server, run npm run db:generate --workspace=web, then restart.";
  }

  return "Could not save settings. Check your entries and try again.";
}
