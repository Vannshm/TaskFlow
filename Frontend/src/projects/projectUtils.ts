export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived",
    TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review",
  };
  return labels[status] || status.replaceAll("_", " ");
}
