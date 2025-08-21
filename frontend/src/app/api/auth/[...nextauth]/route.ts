import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

const handler = NextAuth({
  // Placeholder config to satisfy session endpoint; replace with real providers later
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        // No real login yet; always return null to deny sign-in
        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
})

export { handler as GET, handler as POST }
