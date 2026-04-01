export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function subtractDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() - n);
  return result;
}

export function getDateRange(
  period: string,
  from?: string,
  to?: string,
): { from: string; to: string; groupBy: string } {
  const now = new Date();
  const toDate = to || isoDate(now);
  let fromDate: string;
  let groupBy = "day";

  switch (period) {
    case "today":
      fromDate = toDate;
      groupBy = "hour";
      break;
    case "7d":
      fromDate = isoDate(subtractDays(now, 7));
      break;
    case "30d":
      fromDate = isoDate(subtractDays(now, 30));
      break;
    case "90d":
      fromDate = isoDate(subtractDays(now, 90));
      break;
    case "12m":
      fromDate = isoDate(subtractDays(now, 365));
      groupBy = "month";
      break;
    case "custom":
      fromDate = from || isoDate(subtractDays(now, 30));
      if (fromDate === toDate) groupBy = "hour";
      break;
    default:
      fromDate = isoDate(subtractDays(now, 30));
  }

  return { from: fromDate, to: toDate, groupBy };
}
