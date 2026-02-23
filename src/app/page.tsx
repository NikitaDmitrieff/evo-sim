export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="max-w-xl px-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Evolution Simulation
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          A visual simulation of a global ecosystem. Creatures with evolving
          traits compete, reproduce, and die across generations. Predator-prey
          dynamics, natural selection, and emergent behavior — all playing out
          in front of you.
        </p>
      </main>
    </div>
  );
}
