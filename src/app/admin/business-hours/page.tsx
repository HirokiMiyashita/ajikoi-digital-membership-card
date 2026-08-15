import {
  BUSINESS_HOUR_DAYS,
  BUSINESS_HOUR_DAY_LABELS,
  minuteToTime,
} from "@/lib/business-hours";
import { requireAdminUser } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import BusinessHoursForm from "./business-hours-form";

export default async function AdminBusinessHoursPage() {
  const admin = await requireAdminUser();
  const rows = await prisma.storeBusinessHour.findMany({
    where: { officialAccountId: admin.officialAccountId! },
  });
  const rowMap = new Map(rows.map((row) => [row.day, row]));

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold">営業時間登録</h1>
        <p className="text-sm text-[#64748b]">
          日本時間で自動的に開店・閉店表示を切り替えます。祝日の設定は曜日設定より優先されます。
        </p>
      </div>
      <BusinessHoursForm
        initialRows={BUSINESS_HOUR_DAYS.map((day) => {
          const row = rowMap.get(day);
          return {
            day,
            label: BUSINESS_HOUR_DAY_LABELS[day],
            isClosed: row?.isClosed ?? true,
            openingTime: minuteToTime(row?.openingMinute ?? null) || "10:00",
            closingTime: minuteToTime(row?.closingMinute ?? null) || "22:00",
          };
        })}
      />
    </div>
  );
}
