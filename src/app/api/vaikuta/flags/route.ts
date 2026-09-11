import { NextResponse } from "next/server";
import { vaikutaFlags } from "@/lib/vaikuta/flags";

export async function GET() {
  return NextResponse.json({ flags: vaikutaFlags() });
}