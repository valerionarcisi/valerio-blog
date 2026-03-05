export function getDateRange(
  period: string,
  from?: string,
  to?: string,
): { from: string; to: string; groupBy: string } {
  const now = new Date();
  const toDate = to || now.toISOString().slice(0, 10);
  let fromDate: string;
  let groupBy = "day";

  switch (period) {
    case "today":
      fromDate = toDate;
      groupBy = "hour";
      break;
    case "7d":
      fromDate = new Date(now.getTime() - 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      break;
    case "30d":
      fromDate = new Date(now.getTime() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      break;
    case "90d":
      fromDate = new Date(now.getTime() - 90 * 86400000)
        .toISOString()
        .slice(0, 10);
      break;
    case "12m":
      fromDate = new Date(now.getTime() - 365 * 86400000)
        .toISOString()
        .slice(0, 10);
      groupBy = "month";
      break;
    case "custom":
      fromDate =
        from ||
        new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      if (fromDate === toDate) groupBy = "hour";
      break;
    default:
      fromDate = new Date(now.getTime() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
  }

  return { from: fromDate, to: toDate, groupBy };
}
