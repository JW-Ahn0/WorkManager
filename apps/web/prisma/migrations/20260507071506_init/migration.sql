-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT NOT NULL,
    "context" JSONB,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT,
    "agenda" JSONB NOT NULL,
    "decisions" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "notes" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "appendedToWorklogAt" TIMESTAMP(3),

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorklogEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "project" TEXT NOT NULL DEFAULT '',
    "contentMd" TEXT NOT NULL,

    CONSTRAINT "WorklogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memo_createdAt_idx" ON "Memo"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_memoId_key" ON "Minutes"("memoId");

-- CreateIndex
CREATE INDEX "Minutes_createdAt_idx" ON "Minutes"("createdAt");

-- CreateIndex
CREATE INDEX "Minutes_memoId_idx" ON "Minutes"("memoId");

-- CreateIndex
CREATE INDEX "WorklogEntry_date_idx" ON "WorklogEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorklogEntry_date_project_key" ON "WorklogEntry"("date", "project");

-- CreateIndex
CREATE INDEX "Task_status_order_idx" ON "Task"("status", "order");

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
