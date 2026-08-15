import { redirect } from "next/navigation";

export default function LegacyAdminSetupPage() {
  redirect("/admin/signup");
}
