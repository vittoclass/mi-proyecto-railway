import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "");
const ALG = "HS256";

export async function createSessionToken(payload: { email: string }) {
  if (!process.env.AUTH_SECRET) throw new Error("Falta AUTH_SECRET");
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  return payload as { email: string; iat: number; exp: number };
}
