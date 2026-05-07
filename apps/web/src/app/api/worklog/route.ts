import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const query = z
    .object({
      date: z.string().optional(),
      project: z.string().optional(),
    })
    .parse({
      date: searchParams.get("date") ?? undefined,
      project: searchParams.get("project") ?? undefined,
    });

  if (query.date) {
    const entry = await prisma.worklogEntry.findUnique({
      where: { date_project: { date: query.date, project: query.project ?? "" } },
    });
    return NextResponse.json({ entry });
  }

  const entries = await prisma.worklogEntry.findMany({
    orderBy: { date: "desc" },
    take: 50,
  });
  return NextResponse.json({ entries });
}

