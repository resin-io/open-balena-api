ALTER TABLE "release" ADD COLUMN "release type" VARCHAR(255) NOT NULL DEFAULT 'final',
ADD COLUMN "is passing tests" INTEGER NOT NULL DEFAULT 1;
