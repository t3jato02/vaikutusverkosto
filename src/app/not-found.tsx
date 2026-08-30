import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="mt-2 text-sm text-ink-500">Toimijaa tai sivua ei löytynyt.</p>
      <Link href="/" className="btn mt-4">Etusivulle</Link>
    </div>
  );
}