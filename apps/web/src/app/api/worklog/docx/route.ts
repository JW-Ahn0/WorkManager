import { NextResponse } from "next/server";
import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

import { prisma } from "@/server/db/prisma";
import { ensureCurrentBoard } from "@/server/boards/current";

function ymdDot(d: Date) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
} as const;

function cell(text: string, opts?: { bold?: boolean; alignCenter?: boolean }) {
  return [
    new Paragraph({
      children: [new TextRun({ text, bold: !!opts?.bold, size: 22 })],
      alignment: opts?.alignCenter ? "center" : undefined,
    }),
  ];
}

function bullets(lines: string[]) {
  if (!lines.length) return [new Paragraph({ children: [new TextRun({ text: "(없음)", size: 22 })] })];
  return lines.map(
    (t) =>
      new Paragraph({
        text: t,
        bullet: { level: 0 },
        spacing: { after: 60 },
      }),
  );
}

export async function GET() {
  const board = await ensureCurrentBoard();
  const tasks = await prisma.task.findMany({
    where: { boardId: board.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { order: "asc" }],
    select: { title: true, description: true, status: true },
  });

  const today = new Date();

  const todo = tasks.filter((t) => t.status === "TODO");
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");

  const lines = [
    ...todo.map((t) => `TODO - ${t.title}`),
    ...inProgress.map((t) => `IN PROGRESS - ${t.title}`),
    ...done.map((t) => `DONE - ${t.title}`),
  ];

  // 사진과 비슷한 4열 테이블 레이아웃
  // [라벨 | 빈칸] [라벨 | 빈칸]
  // [금일 업무내역 | (3칸 병합)]
  // [익일 업무계획 | (3칸 병합)]
  // [미처리 ... (4칸 병합)]
  // [빈칸(4칸 병합)]
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell("성명", { bold: true }),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell(""),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell("소속", { bold: true }),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell(""),
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell("직책", { bold: true }),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell(""),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell("작성일자", { bold: true }),
          }),
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: cell(ymdDot(today)),
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: cell("금일\n업무내역", { bold: true }),
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            borders: CELL_BORDER,
            columnSpan: 3,
            width: { size: 85, type: WidthType.PERCENTAGE },
            children: bullets(lines),
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: cell("익일\n업무계획", { bold: true }),
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            borders: CELL_BORDER,
            columnSpan: 3,
            width: { size: 85, type: WidthType.PERCENTAGE },
            children: bullets([]),
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            columnSpan: 4,
            children: cell("미처리 업무내역 및 특이사항", { bold: true, alignCenter: true }),
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDER,
            columnSpan: 4,
            children: [new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "주간업무일지", bold: true, size: 32 })] }),
          new Paragraph({ text: "" }),
          table,
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const filename = `업무일지_${ymdDot(today)}.docx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}

