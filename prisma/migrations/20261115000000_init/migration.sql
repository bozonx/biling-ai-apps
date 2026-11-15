CREATE TABLE "Product" ("id" UUID NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Product_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
