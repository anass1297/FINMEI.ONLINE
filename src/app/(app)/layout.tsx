import { AppShell } from "@/components/app/shell";
import { listUserBusinesses, requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  const businesses = await listUserBusinesses(user.id);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, image: user.image }}
      business={{ id: business.id, name: business.name, logo: business.logo, brandColor: business.brandColor, currency: business.currency }}
      businesses={businesses}
    >
      {children}
    </AppShell>
  );
}
