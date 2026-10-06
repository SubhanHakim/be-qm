const prisma = require("../config/db");

// Fungsi 1: Mengambil daftar parameter
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
const submitIdeCek = async (req, res) => {
  try {
    // Mengambil data yang dikirim dari Frontend (atau Postman)
    const { id_aplikasi, errors, catatan_tambahan } = req.body;
    const id_user_aktif = req.user.id_user;

    // Validasi input dasar
    if (!id_aplikasi || !errors || errors.length === 0) {
      return res.status(400).json({
        msg: "Data tidak lengkap. ID Aplikasi, Nama Analis, dan minimal 1 Error harus diisi.",
      });
    }

    // Jika petugas menceklis banyak error, kita buat banyak baris log sekaligus
    const logData = errors.map((id_error) => ({
      id_aplikasi,
      id_user: id_user_aktif,
      tahap_pengecekan: "IDE",
      id_error: id_error,
      catatan_tambahan: catatan_tambahan || null,
    }));

    // Simpan ke database menggunakan prisma
    await prisma.sendback_Log.createMany({
      data: logData,
    });

    res.status(201).json({ msg: "Data temuan IDE berhasil disimpan!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

const getIdeReport = async (req, res) => {
  try {
    const laporan = await prisma.sendback_Log.findMany({
      include: {
        master_error: true,
        user: {
          select: { username: true, role: true },
        },
      },
      orderBy: {
        tanggal_input: "desc",
      },
    });

    // Grouping temuan per aplikasi
    const groupedMap = new Map();

    for (const item of laporan) {
      const appId = item.id_aplikasi;

      if (!groupedMap.has(appId)) {
        groupedMap.set(appId, {
          id_aplikasi: appId,
          total_bobot: 0,
          analis: item.user?.username || null,
          errors: [],
        });
      }

      const current = groupedMap.get(appId);

      if (item.master_error) {
        const bobot =
          item.master_error.bobot_error != null
            ? parseFloat(item.master_error.bobot_error.toString())
            : 0;

        current.errors.push({
          nama_field: item.master_error.nama_field,
          bobot: bobot,
        });

        // Menghindari masalah presisi floating point JavaScript
        current.total_bobot = parseFloat(
          (current.total_bobot + bobot).toFixed(2)
        );
      }
    }

    const response = Array.from(groupedMap.values());
    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 4: Mengambil detail laporan pemeriksaan berdasarkan id_aplikasi
const getIdeReportDetail = async (req, res) => {
  try {
    const { id_aplikasi } = req.params;

    if (!id_aplikasi || id_aplikasi.trim() === "") {
      return res.status(400).json({
        message: "ID Aplikasi wajib disertakan pada parameter URL.",
      });
    }

    const logs = await prisma.sendback_Log.findMany({
      where: {
        id_aplikasi: id_aplikasi.trim(),
      },
      include: {
        master_error: true,
        user: {
          select: { id_user: true, username: true, role: true },
        },
      },
      orderBy: {
        id_log: "asc",
      },
    });

    if (!logs || logs.length === 0) {
      return res.status(404).json({
        message: `Data temuan untuk aplikasi dengan ID '${id_aplikasi}' tidak ditemukan.`,
      });
    }

    const firstLog = logs[0];
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

        if (isFatal) {
          hasFatal = true;
        }

        totalBobot = parseFloat((totalBobot + bobot).toFixed(2));

        errorDetails.push({
          id_log: log.id_log,
          id_error: log.master_error.id,
          nama_field: log.master_error.nama_field,
          kategori: log.master_error.kategori,
          bobot: bobot,
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
      id_aplikasi: firstLog.id_aplikasi,
      tahap_pengecekan: firstLog.tahap_pengecekan || "IDE",
      tanggal_input: firstLog.tanggal_input,
      analis: firstLog.user?.username || null,
      user: firstLog.user || null,
      catatan_tambahan: catatan_tambahan,
      total_bobot: totalBobot,
      jumlah_error: errorDetails.length,
      status: status,
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
const updateIdeReport = async (req, res) => {
  try {
    const targetIdAplikasi = req.params.id_aplikasi || req.body.id_aplikasi;
    const { errors, catatan_tambahan, tahap_pengecekan } = req.body;
    const id_user_aktif = req.user?.id_user;

    if (!targetIdAplikasi || targetIdAplikasi.trim() === "") {
      return res.status(400).json({
        msg: "ID Aplikasi harus disertakan.",
      });
    }

    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({
        msg: "Minimal 1 error harus dipilih.",
      });
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
      return res.status(400).json({
        msg: "Daftar error tidak valid.",
      });
    }

    const cleanAppId = targetIdAplikasi.trim();

    // Menggunakan Prisma Transaction untuk memastikan integritas data
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek keberadaan data laporan aplikasi lama
      const existingLogs = await tx.sendback_Log.findMany({
        where: { id_aplikasi: cleanAppId },
      });

      if (!existingLogs || existingLogs.length === 0) {
        throw new Error("NOT_FOUND");
      }

      // Pertahankan tanggal_input asli dan user lama jika tidak ada user baru
      const originalCreatedAt = existingLogs[0].tanggal_input;
      const originalUser = existingLogs[0].id_user;

      // 2. Hapus log error lama untuk aplikasi ini
      await tx.sendback_Log.deleteMany({
        where: { id_aplikasi: cleanAppId },
      });

      // 3. Masukkan log error yang baru
      const newLogData = errorIds.map((id_error) => ({
        id_aplikasi: cleanAppId,
        id_user: id_user_aktif || originalUser,
        tahap_pengecekan:
          tahap_pengecekan || existingLogs[0].tahap_pengecekan || "IDE",
        id_error: id_error,
        catatan_tambahan:
          catatan_tambahan !== undefined
            ? catatan_tambahan
            : existingLogs[0].catatan_tambahan,
        tanggal_input: originalCreatedAt || new Date(),
      }));

      await tx.sendback_Log.createMany({
        data: newLogData,
      });

      return {
        id_aplikasi: cleanAppId,
        total_error: newLogData.length,
      };
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

module.exports = {
  getIdeParameters,
  submitIdeCek,
  getIdeReport,
  getIdeReportDetail,
  updateIdeReport,
};
