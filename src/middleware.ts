import { withAuth } from "next-auth/middleware";

// Edge-level guard (JWT presence). Fine-grained tenancy checks happen server-side
// in requireBusiness() on every request.
export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: [
    "/dashboard/:path*", "/invoices/:path*", "/customers/:path*", "/expenses/:path*",
    "/recurring/:path*", "/payments/:path*", "/reports/:path*", "/settings/:path*", "/onboarding",
    "/api/invoices/:path*", "/api/expenses/:path*", "/api/reports/:path*", "/api/attachments/:path*",
  ],
};
