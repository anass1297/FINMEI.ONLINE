import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        if (!rateLimit(`login:${email}`, 10, 15 * 60_000)) throw new Error("TooManyAttempts");

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        if (requireVerification && !user.emailVerified) throw new Error("EmailNotVerified");
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    ...(googleEnabled
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const email = (profile?.email || user.email || "").toLowerCase();
        // Google guarantees verified emails only when email_verified is true
        if (!email || (profile as { email_verified?: boolean })?.email_verified === false) return false;
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              googleId: existing.googleId ?? account.providerAccountId,
              emailVerified: existing.emailVerified ?? new Date(),
              image: existing.image ?? user.image,
              name: existing.name ?? user.name,
            },
          });
        } else {
          await db.user.create({
            data: { email, name: user.name, image: user.image, googleId: account.providerAccountId, emailVerified: new Date() },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const dbUser = await db.user.findUnique({ where: { email: (user.email || "").toLowerCase() } });
          token.uid = dbUser?.id;
        } else {
          token.uid = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
};
