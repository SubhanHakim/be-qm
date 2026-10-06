const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

// Buat pool koneksi standar
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Bungkus dengan Prisma Adapter
const adapter = new PrismaPg(pool);

// Masukkan adapter ke dalam Prisma Client
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
