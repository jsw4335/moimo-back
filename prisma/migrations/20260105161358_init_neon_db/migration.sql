/*
  Warnings:

  - Made the column `nickname` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "nickname" SET NOT NULL,
ALTER COLUMN "resetCode" DROP NOT NULL;
