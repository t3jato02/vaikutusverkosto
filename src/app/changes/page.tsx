import { getRecentChanges } from "@/lib/queries";
import ChangesList from "@/components/ChangesList";

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const changes = await getRecentChanges(60);
  return (
    <div className="mx-auto max-w-content space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-page-title">Muutokset</h1>
        <p className="mt-2 text-sm text-muted">
          Mitä verkostossa on viimeksi muuttunut: uudet ja päättyneet yhteydet, nimitykset,
          rahavirrat ja päätökset. Samana päivänä samalle toimijalle kirjatut muutokset on
          niputettu yhteen.
        </p>
      </header>
      <div className="card-pad">
        <ChangesList changes={changes} maxGroups={30} />
      </div>
    </div>
  );
}