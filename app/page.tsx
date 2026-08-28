const aiDevelopers = ["Bill", "Ted", "Dave", "Andy"] as const;

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20 sm:px-10 lg:px-16">
        <div className="grid items-end gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20">
          <header>
            <div
              className="h-1 w-10 rounded-full bg-accent"
              aria-hidden="true"
            />
            <h1 className="font-display mt-8 text-5xl leading-[1.05] font-normal tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
              Cliff Pearson
            </h1>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted text-pretty">
              A simple public page. More can go here later.
            </p>
          </header>

          <section aria-labelledby="ai-developers-heading">
            <h2
              id="ai-developers-heading"
              className="text-sm tracking-[0.2em] text-muted uppercase"
            >
              AI developers
            </h2>
            <ul className="mt-6 border-t border-line">
              {aiDevelopers.map((name, index) => (
                <li
                  key={name}
                  className="flex items-baseline gap-5 border-b border-line py-3.5"
                >
                  <span
                    className="w-8 shrink-0 text-xs tracking-[0.14em] text-muted tabular-nums"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-2xl leading-none tracking-[-0.02em] sm:text-[1.75rem]">
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
