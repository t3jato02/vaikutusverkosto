import { redirect } from "next/navigation";
import { getEntityById, entityUrlFor, resolveShortId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EntityRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fullId = /^[0-9a-f]{8}$/.test(id) ? await resolveShortId(id) : id;
  const entity = fullId ? await getEntityById(fullId) : null;
  if (!entity) {
    return <div className="card mt-10 text-center text-sm text-ink-500">Toimijaa ei löytynyt.</div>;
  }
  redirect(entityUrlFor(entity.id, entity.type, entity.canonicalName));
}