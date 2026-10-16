-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Master_Error_IDE" (
    "id" SERIAL NOT NULL,
    "nama_field" VARCHAR(100) NOT NULL,
    "bobot_error" DECIMAL(3,1) NOT NULL,
    "kategori" VARCHAR(50),

    CONSTRAINT "Master_Error_IDE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aplikasi_Header" (
    "id" SERIAL NOT NULL,
    "id_aplikasi" VARCHAR(50) NOT NULL,
    "nama_aplikan" VARCHAR(150),
    "nama_user_ide" VARCHAR(100),
    "cas_sas" VARCHAR(20),
    "channel" VARCHAR(50),
    "tanggal_input" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_user" INTEGER,

    CONSTRAINT "Aplikasi_Header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sendback_Log" (
    "id_log" SERIAL NOT NULL,
    "id_aplikasi" VARCHAR(50) NOT NULL,
    "tahap_pengecekan" VARCHAR(50) DEFAULT 'IDE',
    "id_error" INTEGER,
    "tanggal_input" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "catatan_tambahan" TEXT,
    "id_user" INTEGER,

    CONSTRAINT "Sendback_Log_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "User" (
    "id_user" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" VARCHAR(50) NOT NULL DEFAULT 'analis',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id_user")
);

-- CreateIndex
CREATE UNIQUE INDEX "Aplikasi_Header_id_aplikasi_key" ON "Aplikasi_Header"("id_aplikasi");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Aplikasi_Header" ADD CONSTRAINT "Aplikasi_Header_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sendback_Log" ADD CONSTRAINT "Sendback_Log_id_error_fkey" FOREIGN KEY ("id_error") REFERENCES "Master_Error_IDE"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sendback_Log" ADD CONSTRAINT "Sendback_Log_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

