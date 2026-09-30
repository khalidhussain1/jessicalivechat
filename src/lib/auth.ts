import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, upsertGoogleUser } from "@/lib/users-db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password =
          typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user || !user.passwordHash) return null;
        if (!bcrypt.compareSync(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await upsertGoogleUser(user.email, user.name ?? user.email);
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) token.id = user.id;
      if (trigger === "update" && session?.name) token.name = session.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
