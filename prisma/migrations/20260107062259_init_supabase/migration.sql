-- DropIndex
DROP INDEX "users_resetCode_key";

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;
