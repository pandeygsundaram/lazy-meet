-- AlterTable
ALTER TABLE "recordings" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'uploaded',
ALTER COLUMN "summary" DROP NOT NULL,
ALTER COLUMN "transcription" DROP NOT NULL;
