import { isAdminSession } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";

export const dynamic = "force-dynamic";

export default async function Header() {
  const admin = await isAdminSession();
  return <HeaderNav admin={admin} />;
}