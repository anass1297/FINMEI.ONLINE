import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileSettings } from "@/components/app/settings-forms";

export const metadata = { title: "Profile & security" };

export default async function Page() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profile & security" />
      <ProfileSettings name={user.name ?? ""} email={user.email} hasPassword={Boolean(user.passwordHash)} google={Boolean(user.googleId)} />
    </div>
  );
}
