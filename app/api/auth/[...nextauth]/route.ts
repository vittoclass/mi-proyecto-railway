import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Nombre", type: "text" },
        school: { label: "Institución", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (!error && data.user) {
          const { data: profile } = await supabase
            .from("users")
            .select("name, school")
            .eq("id", data.user.id)
            .single();

          return {
            id: data.user.id,
            email: data.user.email,
            name: profile?.name || credentials.name,
            school: profile?.school || credentials.school,
          };
        }

        if (credentials.name && credentials.school) {
          const { data: newUser, error: signUpError } =
            await supabase.auth.signUp({
              email: credentials.email,
              password: credentials.password,
              options: {
                data: {
                  name: credentials.name,
                  school: credentials.school,
                },
              },
            });

          if (!signUpError && newUser.user) {
            await supabase.from("users").upsert({
              id: newUser.user.id,
              email: credentials.email,
              name: credentials.name,
              school: credentials.school,
            });

            return {
              id: newUser.user.id,
              email: credentials.email,
              name: credentials.name,
              school: credentials.school,
            };
          }
        }

        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.school = user.school;
      }
      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.school = token.school;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt" as const,   // ✅ ESTA ES LA LÍNEA ARREGLADA
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
