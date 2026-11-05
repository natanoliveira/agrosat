-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "SceneSource" AS ENUM ('stac', 'fixtures');

-- CreateEnum
CREATE TYPE "ZoneClass" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('drop', 'patch');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('medium', 'high');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('history', 'report');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "farm" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "geom" geometry(Polygon, 4326) NOT NULL,
    "areaHa" DECIMAL(12,4) NOT NULL,
    "needsReprocess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ndvi_scene" (
    "id" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "sceneDate" DATE NOT NULL,
    "source" "SceneSource" NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "validPct" DECIMAL(5,2) NOT NULL,
    "mean" DOUBLE PRECISION,
    "median" DOUBLE PRECISION,
    "p10" DOUBLE PRECISION,
    "p90" DOUBLE PRECISION,
    "pngPath" TEXT,
    "ndviPath" TEXT,
    "bounds" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ndvi_scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "class" "ZoneClass" NOT NULL,
    "geom" geometry(MultiPolygon, 4326) NOT NULL,
    "areaHa" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "sceneDate" DATE NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "geom" geometry(Geometry, 4326),
    "notifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "plotId" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "result" JSONB,
    "startedAt" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "plotId" UUID NOT NULL,
    "jobId" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farm_name_key" ON "farm"("name");

-- CreateIndex
CREATE INDEX "plot_geom_idx" ON "plot" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "plot_farmId_idx" ON "plot"("farmId");

-- CreateIndex
CREATE INDEX "ndvi_scene_plotId_sceneDate_idx" ON "ndvi_scene"("plotId", "sceneDate");

-- CreateIndex
CREATE UNIQUE INDEX "ndvi_scene_plotId_sceneDate_key" ON "ndvi_scene"("plotId", "sceneDate");

-- CreateIndex
CREATE INDEX "zone_geom_idx" ON "zone" USING GIST ("geom");

-- CreateIndex
CREATE UNIQUE INDEX "zone_sceneId_class_key" ON "zone"("sceneId", "class");

-- CreateIndex
CREATE INDEX "alert_plotId_sceneDate_idx" ON "alert"("plotId", "sceneDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alert_plotId_sceneDate_type_key" ON "alert"("plotId", "sceneDate", "type");

-- CreateIndex
CREATE INDEX "job_plotId_status_idx" ON "job"("plotId", "status");

-- CreateIndex
CREATE INDEX "report_plotId_generatedAt_idx" ON "report"("plotId", "generatedAt" DESC);

-- AddForeignKey
ALTER TABLE "plot" ADD CONSTRAINT "plot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndvi_scene" ADD CONSTRAINT "ndvi_scene_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ndvi_scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ndvi_scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "plot" ADD CONSTRAINT "plot_geom_valid" CHECK (ST_IsValid("geom"));
