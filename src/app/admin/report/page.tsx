import { requireAdminUser } from "@/lib/admin-guard";
import { getAdminReportMetricsResponse } from "@/orpc/router";
import ReportClient from "./report-client";

export default async function AdminReportPage() {
  const adminUser = await requireAdminUser();
  const initialData = await getAdminReportMetricsResponse(adminUser.officialAccountId ?? null);

  return (
    <ReportClient initialData={initialData} />
  );
}
