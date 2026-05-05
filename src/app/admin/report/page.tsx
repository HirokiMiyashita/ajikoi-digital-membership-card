import { requireAdminUser } from "@/lib/admin-guard";
import ReportClient from "./report-client";

export default async function AdminReportPage() {
  await requireAdminUser();

  return (
    <ReportClient />
  );
}
