export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16 sm:px-8">
        <p className="text-sm tracking-[0.18em] text-muted uppercase">
          Starter site
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Cliff Pearson
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted text-pretty">
          A simple public page. More can go here later.
        </p>
      </main>
    </div>
  );
}
