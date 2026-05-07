import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { ensureCurrentBoard } from "@/server/boards/current";

const CreateTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const board = await ensureCurrentBoard();
    const tasks = await prisma.task.findMany({
      where: { boardId: board.id },
      orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ board, tasks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load tasks" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const board = await ensureCurrentBoard();
  const body = CreateTaskBody.parse(await req.json());

  const max = await prisma.task.aggregate({
    where: { boardId: board.id, status: "TODO" },
    _max: { order: true },
  });
  const order = (max._max.order ?? 0) + 1;

  const task = await prisma.task.create({
    data: {
      boardId: board.id,
      title: body.title,
      description: body.description ?? "",
      status: "TODO",
      order,
    },
  });
  return NextResponse.json({ task });
}

