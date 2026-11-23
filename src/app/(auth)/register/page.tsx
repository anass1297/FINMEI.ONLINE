import { RegisterForm } from "@/components/app/auth-forms";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Create account" };
export default function Page() {
  return <RegisterForm google={googleEnabled} />;
}
