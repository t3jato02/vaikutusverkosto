import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  // Redirect back to the request's own origin (never a hardcoded domain).
  return clearSessionCookie(NextResponse.redirect(new URL("/", req.url), 303));
}