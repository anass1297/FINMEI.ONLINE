import { Suspense } from "react";
import { LoginForm } from "@/components/app/auth-forms";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export default function Page() {
  return <Suspense><LoginForm google={googleEnabled} /></Suspense>;
}
