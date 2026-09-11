import { NextResponse } from "next/server";
import { clearUserSessionCookie } from "@/lib/vaikuta/authUser";

export async function POST() {
  return clearUserSessionCookie(NextResponse.redirect(new URL("/vaikuta", process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"), 303));
}