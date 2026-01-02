/*
  Warnings:

  - You are about to drop the column `address` on the `meetings` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `meetings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `participations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user_interests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_interests" DROP CONSTRAINT "user_interests_interest_id_fkey";

-- DropForeignKey
ALTER TABLE "user_interests" DROP CONSTRAINT "user_interests_user_id_fkey";

-- AlterTable
ALTER TABLE "meetings" DROP COLUMN "address",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "participations" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user_interests" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
DROP COLUMN "provider",
DROP COLUMN "provider_id",
DROP COLUMN "role",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" SERIAL NOT NULL,
    "google_sub_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_google_sub_id_key" ON "social_accounts"("google_sub_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_key" ON "social_accounts"("user_id");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
