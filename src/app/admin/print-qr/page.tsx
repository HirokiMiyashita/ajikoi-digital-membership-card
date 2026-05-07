import { requireAdminUser } from "@/lib/admin-guard";
import PrintQrClient from "./print-qr-client";

export default async function AdminPrintQrPage() {
  await requireAdminUser();

  return (
    <div className="p-4">
      <PrintQrClient />
    </div>
  );
}
