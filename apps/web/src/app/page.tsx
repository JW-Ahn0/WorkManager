import { TaskBoard } from "@/components/TaskBoard/TaskBoard";

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 font-sans">
      <main className="w-full max-w-6xl px-6 py-10">
        <TaskBoard />
      </main>
    </div>
  );
}
