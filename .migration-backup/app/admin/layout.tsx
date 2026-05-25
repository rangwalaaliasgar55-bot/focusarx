import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/server/admin-auth";

export const metadata = {
  title: "Admin · FocusArx",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return <AdminGate />;
  }

  return <AdminShell>{children}</AdminShell>;
}
