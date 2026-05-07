import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { ensureCurrentBoard } from "@/server/boards/current";

const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const board = await ensureCurrentBoard();
  const { id } = await ctx.params;
  const body = UpdateTaskBody.parse(await req.json());

  const task = await prisma.task.updateMany({
    where: { id, boardId: board.id },
    data: body,
  });

  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const board = await ensureCurrentBoard();
  const { id } = await ctx.params;
  await prisma.task.deleteMany({ where: { id, boardId: board.id } });
  return NextResponse.json({ ok: true });
}

