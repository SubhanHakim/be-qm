const prisma = require("../config/db");

// Fungsi 1: Mengambil daftar parameter error IDE
const getIdeParameters = async (req, res) => {
  try {
    const result = await prisma.master_Error_IDE.findMany({
      orderBy: { id: "asc" },
    });
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 2: Menyimpan hasil ceklis petugas
// Body: { id_aplikasi, nama_aplikan, nama_user_ide, cas_sas, channel, errors, catatan_tambahan }
const submitIdeCek = async (req, res) => {
  try {
    const {
      id_aplikasi,
      nama_aplikan,
      nama_user_ide,
      cas_sas,
      channel,
      errors,
      catatan_tambahan,
    } = req.body;
    const id_user_aktif = req.user.id_user;

    // Validasi input dasar
    if (!id_aplikasi || !errors || errors.length === 0) {
      return res.status(400).json({
        msg: "Data tidak lengkap. ID Aplikasi dan minimal 1 Error harus diisi.",
      });
    }

    // Gunakan transaction agar header & log tersimpan bersama-sama
    const result = await prisma.$transaction(async (tx) => {
      // 1. Simpan/update header aplikasi (data identitas: nama aplikan, user IDE, dll)
      const header = await tx.aplikasi_Header.upsert({
        where: { id_aplikasi: id_aplikasi },
        update: {
          nama_aplikan: nama_aplikan || null,
          nama_user_ide: nama_user_ide || null,
          cas_sas: cas_sas || null,
          channel: channel || null,
          id_user: id_user_aktif,
        },
        create: {
          id_aplikasi,
          nama_aplikan: nama_aplikan || null,
          nama_user_ide: nama_user_ide || null,
          cas_sas: cas_sas || null,
          channel: channel || null,
          id_user: id_user_aktif,
        },
      });

      // 2. Hapus log error lama jika ada (untuk menghindari duplikat saat re-submit)
      await tx.sendback_Log.deleteMany({
        where: { id_aplikasi: id_aplikasi },
      });

      // 3. Simpan semua log error baru
      const logData = errors.map((id_error) => ({
        id_aplikasi,
        id_user: id_user_aktif,
        tahap_pengecekan: "IDE",
        id_error: id_error,
        catatan_tambahan: catatan_tambahan || null,
      }));

      await tx.sendback_Log.createMany({ data: logData });

      return { id_aplikasi, total_error: logData.length };
    });

    res.status(201).json({
      msg: "Data temuan IDE berhasil disimpan!",
      data: result,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 3: Mengambil ringkasan laporan semua aplikasi
const getIdeReport = async (req, res) => {
  try {
    // Ambil semua header aplikasi beserta log error-nya
    const headers = await prisma.aplikasi_Header.findMany({
      include: {
        user: {
          select: { username: true, role: true },
        },
      },
      orderBy: { tanggal_input: "desc" },
    });

    const laporan = await prisma.sendback_Log.findMany({
      include: {
        master_error: true,
      },
    });

    // Buat map dari id_aplikasi ke errors
    const errorMap = new Map();
    for (const item of laporan) {
      if (!errorMap.has(item.id_aplikasi)) {
        errorMap.set(item.id_aplikasi, { total_bobot: 0, errors: [] });
      }
      const current = errorMap.get(item.id_aplikasi);
      if (item.master_error) {
        const bobot =
          item.master_error.bobot_error != null
            ? parseFloat(item.master_error.bobot_error.toString())
            : 0;
        current.errors.push({
          nama_field: item.master_error.nama_field,
          bobot,
        });
        current.total_bobot = parseFloat(
          (current.total_bobot + bobot).toFixed(2)
        );
      }
    }

    // Gabungkan header dengan data error
    const response = headers.map((h) => {
      const errorData = errorMap.get(h.id_aplikasi) || {
        total_bobot: 0,
        errors: [],
      };
      return {
        id_aplikasi: h.id_aplikasi,
        nama_aplikan: h.nama_aplikan,
        nama_user_ide: h.nama_user_ide,
        cas_sas: h.cas_sas,
        channel: h.channel,
        tanggal_input: h.tanggal_input,
        analis: h.user?.username || null,
        total_bobot: errorData.total_bobot,
        jumlah_error: errorData.errors.length,
        errors: errorData.errors,
      };
    });

    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 4: Mengambil detail laporan berdasarkan id_aplikasi
const getIdeReportDetail = async (req, res) => {
  try {
    const { id_aplikasi } = req.params;

    if (!id_aplikasi || id_aplikasi.trim() === "") {
      return res.status(400).json({
        message: "ID Aplikasi wajib disertakan pada parameter URL.",
      });
    }

    // Ambil header aplikasi
    const header = await prisma.aplikasi_Header.findUnique({
      where: { id_aplikasi: id_aplikasi.trim() },
      include: {
        user: {
          select: { id_user: true, username: true, role: true },
        },
      },
    });

    // Ambil log error
    const logs = await prisma.sendback_Log.findMany({
      where: { id_aplikasi: id_aplikasi.trim() },
      include: {
        master_error: true,
        user: {
          select: { id_user: true, username: true, role: true },
        },
      },
      orderBy: { id_log: "asc" },
    });

    if (!header && (!logs || logs.length === 0)) {
      return res.status(404).json({
        message: `Data temuan untuk aplikasi dengan ID '${id_aplikasi}' tidak ditemukan.`,
      });
    }

    const catatan_tambahan =
      logs.find((l) => l.catatan_tambahan && l.catatan_tambahan.trim() !== "")
        ?.catatan_tambahan || null;

    let totalBobot = 0;
    let hasFatal = false;
    const errorDetails = [];

    for (const log of logs) {
      if (log.master_error) {
        const bobot =
          log.master_error.bobot_error != null
            ? parseFloat(log.master_error.bobot_error.toString())
            : 0;

        const isFatal =
          (log.master_error.kategori || "").toLowerCase().includes("fatal") ||
          bobot >= 1.0;

        if (isFatal) hasFatal = true;

        totalBobot = parseFloat((totalBobot + bobot).toFixed(2));

        errorDetails.push({
          id_log: log.id_log,
          id_error: log.master_error.id,
          nama_field: log.master_error.nama_field,
          kategori: log.master_error.kategori,
          bobot,
          is_fatal: isFatal,
        });
      }
    }

    let status = "Lolos";
    if (hasFatal) {
      status = "Fatal";
    } else if (totalBobot > 0) {
      status = "Minor";
    }

    const detail = {
      // Data Header Aplikasi (sesuai form)
      id_aplikasi: id_aplikasi.trim(),
      nama_aplikan: header?.nama_aplikan || null,
      nama_user_ide: header?.nama_user_ide || null,
      cas_sas: header?.cas_sas || null,
      channel: header?.channel || null,

      // Data Pemeriksaan
      tahap_pengecekan: "IDE",
      tanggal_input: header?.tanggal_input || logs[0]?.tanggal_input || null,
      analis: header?.user?.username || logs[0]?.user?.username || null,
      user: header?.user || logs[0]?.user || null,
      catatan_tambahan,
      total_bobot: totalBobot,
      jumlah_error: errorDetails.length,
      status,
      has_fatal: hasFatal,
      errors: errorDetails,
    };

    res.json(detail);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 5: Memperbarui (edit) temuan IDE untuk sebuah aplikasi
// Body: { nama_aplikan, nama_user_ide, cas_sas, channel, errors, catatan_tambahan, tahap_pengecekan }
const updateIdeReport = async (req, res) => {
  try {
    const targetIdAplikasi = req.params.id_aplikasi || req.body.id_aplikasi;
    const {
      nama_aplikan,
      nama_user_ide,
      cas_sas,
      channel,
      errors,
      catatan_tambahan,
      tahap_pengecekan,
    } = req.body;
    const id_user_aktif = req.user?.id_user;

    if (!targetIdAplikasi || targetIdAplikasi.trim() === "") {
      return res.status(400).json({ msg: "ID Aplikasi harus disertakan." });
    }

    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ msg: "Minimal 1 error harus dipilih." });
    }

    // Normalisasi error IDs (mendukung [1, 2] maupun [{ id_error: 1 }])
    const errorIds = errors
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return item.id_error || item.id;
        }
        return Number(item);
      })
      .filter((id) => !isNaN(id) && id !== null);

    if (errorIds.length === 0) {
      return res.status(400).json({ msg: "Daftar error tidak valid." });
    }

    const cleanAppId = targetIdAplikasi.trim();

    const result = await prisma.$transaction(async (tx) => {
      // Cek apakah header sudah ada
      const existingHeader = await tx.aplikasi_Header.findUnique({
        where: { id_aplikasi: cleanAppId },
      });

      if (!existingHeader) {
        throw new Error("NOT_FOUND");
      }

      // 1. Update header jika ada perubahan data identitas
      await tx.aplikasi_Header.update({
        where: { id_aplikasi: cleanAppId },
        data: {
          nama_aplikan: nama_aplikan !== undefined ? nama_aplikan : existingHeader.nama_aplikan,
          nama_user_ide: nama_user_ide !== undefined ? nama_user_ide : existingHeader.nama_user_ide,
          cas_sas: cas_sas !== undefined ? cas_sas : existingHeader.cas_sas,
          channel: channel !== undefined ? channel : existingHeader.channel,
          id_user: id_user_aktif || existingHeader.id_user,
        },
      });

      // 2. Hapus log error lama
      await tx.sendback_Log.deleteMany({
        where: { id_aplikasi: cleanAppId },
      });

      // 3. Masukkan log error yang baru
      const newLogData = errorIds.map((id_error) => ({
        id_aplikasi: cleanAppId,
        id_user: id_user_aktif || existingHeader.id_user,
        tahap_pengecekan: tahap_pengecekan || "IDE",
        id_error,
        catatan_tambahan:
          catatan_tambahan !== undefined
            ? catatan_tambahan
            : null,
      }));

      await tx.sendback_Log.createMany({ data: newLogData });

      return { id_aplikasi: cleanAppId, total_error: newLogData.length };
    });

    res.status(200).json({
      msg: "Data temuan IDE berhasil diperbarui!",
      data: result,
    });
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      return res.status(404).json({
        msg: `Data temuan untuk aplikasi '${req.params.id_aplikasi || req.body.id_aplikasi}' tidak ditemukan.`,
      });
    }
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 6: Ambil header aplikasi saja (untuk prefill form edit)
const getAplikasiHeader = async (req, res) => {
  try {
    const { id_aplikasi } = req.params;

    if (!id_aplikasi || id_aplikasi.trim() === "") {
      return res.status(400).json({ message: "ID Aplikasi wajib diisi." });
    }

    const header = await prisma.aplikasi_Header.findUnique({
      where: { id_aplikasi: id_aplikasi.trim() },
      include: {
        user: { select: { username: true, role: true } },
      },
    });

    if (!header) {
      return res.status(404).json({
        message: `Header untuk aplikasi '${id_aplikasi}' tidak ditemukan.`,
      });
    }

    res.json(header);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  getIdeParameters,
  submitIdeCek,
  getIdeReport,
  getIdeReportDetail,
  updateIdeReport,
  getAplikasiHeader,
};
