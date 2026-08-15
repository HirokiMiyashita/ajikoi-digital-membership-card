import * as holidayJp from "@holiday-jp/holiday_jp";
import { BusinessHourDay, type StoreBusinessHour } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const BUSINESS_HOUR_DAYS = [
  BusinessHourDay.MONDAY,
  BusinessHourDay.TUESDAY,
  BusinessHourDay.WEDNESDAY,
  BusinessHourDay.THURSDAY,
  BusinessHourDay.FRIDAY,
  BusinessHourDay.SATURDAY,
  BusinessHourDay.SUNDAY,
  BusinessHourDay.HOLIDAY,
] as const;

export const BUSINESS_HOUR_DAY_LABELS: Record<BusinessHourDay, string> = {
  MONDAY: "月曜日",
  TUESDAY: "火曜日",
  WEDNESDAY: "水曜日",
  THURSDAY: "木曜日",
  FRIDAY: "金曜日",
  SATURDAY: "土曜日",
  SUNDAY: "日曜日",
  HOLIDAY: "祝日",
};

const WEEK_DAYS: BusinessHourDay[] = [
  BusinessHourDay.SUNDAY,
  BusinessHourDay.MONDAY,
  BusinessHourDay.TUESDAY,
  BusinessHourDay.WEDNESDAY,
  BusinessHourDay.THURSDAY,
  BusinessHourDay.FRIDAY,
  BusinessHourDay.SATURDAY,
];

function getJstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");
  const jstDate = new Date(Date.UTC(year, month - 1, day));
  return {
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    weekDay: jstDate.getUTCDay(),
    minuteOfDay: hour * 60 + minute,
  };
}

function resolveDay(date: Date) {
  const parts = getJstParts(date);
  return {
    ...parts,
    day: holidayJp.isHoliday(parts.dateKey)
      ? BusinessHourDay.HOLIDAY
      : WEEK_DAYS[parts.weekDay],
  };
}

function isOvernight(row: StoreBusinessHour | undefined) {
  return Boolean(
    row &&
      !row.isClosed &&
      row.openingMinute !== null &&
      row.closingMinute !== null &&
      row.openingMinute > row.closingMinute,
  );
}

export function isOpenFromBusinessHours(rows: StoreBusinessHour[], now = new Date()) {
  const rowMap = new Map(rows.map((row) => [row.day, row]));
  const current = resolveDay(now);
  const currentRow = rowMap.get(current.day);

  if (
    currentRow &&
    !currentRow.isClosed &&
    currentRow.openingMinute !== null &&
    currentRow.closingMinute !== null
  ) {
    if (
      currentRow.openingMinute < currentRow.closingMinute &&
      current.minuteOfDay >= currentRow.openingMinute &&
      current.minuteOfDay < currentRow.closingMinute
    ) {
      return true;
    }
    if (isOvernight(currentRow) && current.minuteOfDay >= currentRow.openingMinute) {
      return true;
    }
  }

  const previous = resolveDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const previousRow = rowMap.get(previous.day);
  if (!previousRow || !isOvernight(previousRow) || previousRow.closingMinute === null) {
    return false;
  }
  return current.minuteOfDay < previousRow.closingMinute;
}

export async function getScheduledStoreStatus(officialAccountId: string, now = new Date()) {
  const rows = await prisma.storeBusinessHour.findMany({
    where: { officialAccountId },
  });
  return {
    isOpen: isOpenFromBusinessHours(rows, now),
    hasSchedule: rows.length > 0,
  };
}

export async function getEffectiveStoreStatus(officialAccountId: string, now = new Date()) {
  const scheduled = await getScheduledStoreStatus(officialAccountId, now);
  if (scheduled.hasSchedule) {
    return { isOpen: scheduled.isOpen, isAutomatic: true };
  }
  const manual = await prisma.storeStatus.upsert({
    where: { officialAccountId },
    create: { officialAccountId, isOpen: false },
    update: {},
    select: { isOpen: true },
  });
  return { isOpen: manual.isOpen, isAutomatic: false };
}

export function minuteToTime(minute: number | null) {
  if (minute === null) return "";
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function timeToMinute(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
