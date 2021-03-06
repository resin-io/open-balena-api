ALTER TABLE "device"
ADD COLUMN IF NOT EXISTS "memory usage" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "memory total" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "storage block device" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "storage usage" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "storage total" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "cpu usage" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "cpu temp" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "cpu id" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "is undervolted" INTEGER DEFAULT 0 NOT NULL;
