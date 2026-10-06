// Memanggil koneksi database yang sudah menggunakan PrismaPg Adapter
const prisma = require("./src/config/db");

async function main() {
  console.log("Mulai memasukkan data parameter IDE...");

  const dataIDE = [
    { nama_field: "CAS", bobot_error: 0.1, kategori: "Minor" },
    {
      nama_field: "MARKETING SOURCE CODE",
      bobot_error: 0.1,
      kategori: "Minor",
    },
    { nama_field: "NO. ID/NIK", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "NAME", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "GENDER", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "PLACE OF BIRTH", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "DATE OF BIRTH", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "MOTHERS MAIDEN NAME", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "ADDRES LINE 1", bobot_error: 0.1, kategori: "Minor" },
    {
      nama_field: "KEC KEL KOTA PROVINSI 1",
      bobot_error: 0.1,
      kategori: "Minor",
    },
    {
      nama_field: "TIPE TELP DAN NO TELP 1",
      bobot_error: 1.0,
      kategori: "Fatal",
    },
    { nama_field: "EMAIL ADDRESS", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "TYPE OF WORK 1", bobot_error: 0.1, kategori: "Minor" },
    { nama_field: "COMPANY NAME", bobot_error: 1.0, kategori: "Fatal" },
    { nama_field: "NIP", bobot_error: 0.1, kategori: "Minor" },
    { nama_field: "NO ERROR", bobot_error: 0.0, kategori: "Sesuai" },
  ];

  await prisma.master_Error_IDE.createMany({
    data: dataIDE,
    skipDuplicates: true,
  });

  console.log("Berhasil! Data parameter IDE sudah masuk ke database.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
