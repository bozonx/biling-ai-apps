ALTER TABLE "Product" ADD COLUMN "lateCommitWindowSec" INTEGER NOT NULL DEFAULT 604800 CHECK ("lateCommitWindowSec" >= 0);
