import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-2">You&apos;re offline</h1>
      <p className="text-neutral-500 text-sm mb-6">
        Bus times need a connection. Open the app again when you&apos;re back
        online.
      </p>
      <Link href="/" className="text-sm underline text-neutral-600">
        Try again
      </Link>
    </main>
  );
}
