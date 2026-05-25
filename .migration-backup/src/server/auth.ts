import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";

/** Auth.js requires a secret to sign JWTs. Production must set AUTH_SECRET. */
const authSecret =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "focusarx-dev-only-secret-not-for-production-use-32chars");

const guestEmail = (guestKey: string) =>
  `guest_${guestKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}@guest.focusarx.internal`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 400 },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email / Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        
        if (!user || !user.hashedPassword) return null;
        
        const isValid = await bcrypt.compare(credentials.password as string, user.hashedPassword);
        if (!isValid) return null;
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {
        guestKey: { label: "Guest key", type: "text" },
      },
      async authorize(credentials) {
        const guestKey = credentials?.guestKey as string | undefined;
        if (!guestKey || guestKey.length < 8) return null;

        const user = await prisma.user.upsert({
          where: { guestKey },
          create: {
            guestKey,
            email: guestEmail(guestKey),
            name: "Guest",
            isGuest: true,
            studyStreak: {
              create: {},
            },
            settings: {
              create: {},
            },
          },
          update: {},
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
