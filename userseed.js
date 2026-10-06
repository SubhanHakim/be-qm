const prisma = require("./src/config/db");
const bcrypt = require("bcrypt");

async function main() {
  console.log("Mulai membuat akun karyawan tanpa NIK...");

  const passwordAsli = "mandiri123";
  const salt = await bcrypt.genSalt(10);
  const passwordAcak = await bcrypt.hash(passwordAsli, salt);

  const user = await prisma.user.create({
    data: {
      username: "subhan_hakim",
      password: passwordAcak,
      role: "analis",
      // Kolom created_at tidak perlu diisi manual karena sudah ada @default(now())
    },
  });

  console.log("Berhasil! Akun karyawan telah dibuat.");
  console.log(`Username Login: ${user.username}`);
  console.log(`Password: ${passwordAsli}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
