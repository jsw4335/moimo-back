/*
  Warnings:

  - You are about to drop the column `interest_id` on the `meetings` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_interest_id_fkey";

-- AlterTable
ALTER TABLE "meetings" DROP COLUMN "interest_id";

-- CreateTable
CREATE TABLE "meeting_interests" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "interest_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_interests_meeting_id_interest_id_key" ON "meeting_interests"("meeting_id", "interest_id");

-- AddForeignKey
ALTER TABLE "meeting_interests" ADD CONSTRAINT "meeting_interests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_interests" ADD CONSTRAINT "meeting_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
