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

    if (!nama_aplikan || !nama_aplikan.trim()) {
      return res.status(400).json({ msg: "Nama Aplikan wajib diisi." });
    }

    if (!nama_user_ide || !nama_user_ide.trim()) {
      return res.status(400).json({ msg: "Nama User IDE wajib diisi." });
    }

    if (!cas_sas || !cas_sas.trim()) {
      return res.status(400).json({ msg: "CAS/SAS wajib diisi." });
    }

    if (!channel || !channel.trim()) {
      return res.status(400).json({ msg: "Channel wajib dipilih." });
    }

    const validChannels = ["MKK", "Bulk Upload", "CAKRA", "RM Tools"];
    if (!validChannels.includes(channel.trim())) {
      return res.status(400).json({
        msg: `Channel tidak valid. Pilih salah satu: ${validChannels.join(", ")}.`,
      });
    }

    // Gunakan transaction agar header & log tersimpan bersama-sama
    const result = await prisma.$transaction(async (tx) => {
      // 1. Simpan/update header aplikasi (data identitas: nama aplikan, user IDE, dll)
      const header = await tx.aplikasi_Header.upsert({
        where: { id_aplikasi: id_aplikasi },
        update: {
          nama_aplikan: nama_aplikan.trim(),
          nama_user_ide: nama_user_ide.trim(),
          cas_sas: cas_sas.trim(),
          channel: channel.trim(),
          id_user: id_user_aktif,
        },
        create: {
          id_aplikasi,
          nama_aplikan: nama_aplikan.trim(),
          nama_user_ide: nama_user_ide.trim(),
          cas_sas: cas_sas.trim(),
          channel: channel.trim(),
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

// Fungsi 7: Rekap agregat bulanan
// Query: ?bulan=10&tahun=2026
const getRekapBulanan = async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan);
    const tahun = parseInt(req.query.tahun);

    if (!bulan || bulan < 1 || bulan > 12) {
      return res.status(400).json({ msg: "Parameter bulan wajib diisi (1–12)." });
    }
    if (!tahun || tahun < 2000 || tahun > 2100) {
      return res.status(400).json({ msg: "Parameter tahun wajib diisi (format: YYYY)." });
    }

    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate   = new Date(tahun, bulan, 1);

    // Ambil semua header di periode tersebut beserta user (analis)
    const headers = await prisma.aplikasi_Header.findMany({
      where: {
        tanggal_input: { gte: startDate, lt: endDate },
      },
      include: {
        user: { select: { username: true } },
      },
    });

    const idAplikasiList = headers.map((h) => h.id_aplikasi);

    // Ambil semua log error untuk aplikasi di periode tersebut
    const logs = await prisma.sendback_Log.findMany({
      where: {
        id_aplikasi: { in: idAplikasiList },
      },
      include: {
        master_error: true,
      },
    });

    // Bangun map: id_aplikasi → { total_bobot, hasFatal, errors[] }
    const appMap = new Map();
    for (const h of headers) {
      appMap.set(h.id_aplikasi, {
        channel:      h.channel || "Tidak Diketahui",
        analis:       h.user?.username || "Unknown",
        total_bobot:  0,
        hasFatal:     false,
        jumlah_error: 0,
      });
    }

    // Hitung frekuensi error untuk top_error
    const errorFreqMap = new Map(); // id_error → { nama_field, kategori, bobot, frekuensi }

    for (const log of logs) {
      const app = appMap.get(log.id_aplikasi);
      if (!app) continue;

      if (log.master_error) {
        const bobot = log.master_error.bobot_error != null
          ? parseFloat(log.master_error.bobot_error.toString())
          : 0;
        const isFatal =
          (log.master_error.kategori || "").toLowerCase().includes("fatal") || bobot >= 1.0;

        app.total_bobot = parseFloat((app.total_bobot + bobot).toFixed(2));
        if (isFatal) app.hasFatal = true;
        app.jumlah_error += 1;

        // Akumulasi frekuensi error
        const errId = log.master_error.id;
        if (!errorFreqMap.has(errId)) {
          errorFreqMap.set(errId, {
            id_error:   errId,
            nama_field: log.master_error.nama_field,
            kategori:   log.master_error.kategori || "-",
            bobot,
            frekuensi:  0,
          });
        }
        errorFreqMap.get(errId).frekuensi += 1;
      }
    }

    // Hitung ringkasan, per_channel, per_analis
    let totalFatal = 0, totalMinor = 0, totalLolos = 0;
    const channelMap = {};
    const analisMap  = {};

    for (const [, app] of appMap) {
      // Status aplikasi
      let status;
      if (app.hasFatal)          { status = "Fatal"; totalFatal++; }
      else if (app.total_bobot > 0) { status = "Minor"; totalMinor++; }
      else                          { status = "Lolos"; totalLolos++; }

      // Per channel
      if (!channelMap[app.channel]) {
        channelMap[app.channel] = { channel: app.channel, total_aplikasi: 0, total_error: 0 };
      }
      channelMap[app.channel].total_aplikasi += 1;
      channelMap[app.channel].total_error    += app.jumlah_error;

      // Per analis
      if (!analisMap[app.analis]) {
        analisMap[app.analis] = {
          username:        app.analis,
          total_aplikasi:  0,
          total_error:     0,
          total_fatal:     0,
          total_minor:     0,
          total_lolos:     0,
        };
      }
      const a = analisMap[app.analis];
      a.total_aplikasi  += 1;
      a.total_error     += app.jumlah_error;
      if (status === "Fatal")  a.total_fatal++;
      else if (status === "Minor") a.total_minor++;
      else                         a.total_lolos++;
    }

    const totalAplikasi = headers.length;
    const totalError    = logs.length;
    const rataBobot     = totalAplikasi > 0
      ? parseFloat((logs.reduce((sum, l) => {
          const b = l.master_error?.bobot_error != null
            ? parseFloat(l.master_error.bobot_error.toString()) : 0;
          return sum + b;
        }, 0) / totalAplikasi).toFixed(2))
      : 0;

    // Top 10 error
    const topError = Array.from(errorFreqMap.values())
      .sort((a, b) => b.frekuensi - a.frekuensi)
      .slice(0, 10);

    const namaBulan = new Date(tahun, bulan - 1, 1)
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    res.json({
      periode:    namaBulan,
      bulan,
      tahun,
      ringkasan: {
        total_aplikasi: totalAplikasi,
        total_error:    totalError,
        rata_rata_bobot: rataBobot,
        total_fatal:    totalFatal,
        total_minor:    totalMinor,
        total_lolos:    totalLolos,
      },
      per_channel: Object.values(channelMap),
      per_analis:  Object.values(analisMap),
      top_error:   topError,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Fungsi 8: Daftar detail aplikasi per bulan (drill-down)
// Query: ?bulan=10&tahun=2026&channel=MKK&analis=analis_a&status=fatal
const getRekapBulananDetail = async (req, res) => {
  try {
    const bulan   = parseInt(req.query.bulan);
    const tahun   = parseInt(req.query.tahun);
    const channel = req.query.channel || null;
    const analis  = req.query.analis  || null;
    const status  = req.query.status  || null; // "fatal" | "minor" | "lolos"

    if (!bulan || bulan < 1 || bulan > 12) {
      return res.status(400).json({ msg: "Parameter bulan wajib diisi (1–12)." });
    }
    if (!tahun || tahun < 2000 || tahun > 2100) {
      return res.status(400).json({ msg: "Parameter tahun wajib diisi (format: YYYY)." });
    }

    const startDate = new Date(tahun, bulan - 1, 1);
    const endDate   = new Date(tahun, bulan, 1);

    // Ambil header dengan filter channel & analis jika ada
    const headers = await prisma.aplikasi_Header.findMany({
      where: {
        tanggal_input: { gte: startDate, lt: endDate },
        ...(channel ? { channel } : {}),
        ...(analis  ? { user: { username: analis } } : {}),
      },
      include: {
        user: { select: { username: true, role: true } },
      },
      orderBy: { tanggal_input: "desc" },
    });

    const idAplikasiList = headers.map((h) => h.id_aplikasi);

    const logs = await prisma.sendback_Log.findMany({
      where: { id_aplikasi: { in: idAplikasiList } },
      include: { master_error: true },
    });

    // Bangun map error per aplikasi
    const errorMap = new Map();
    for (const log of logs) {
      if (!errorMap.has(log.id_aplikasi)) {
        errorMap.set(log.id_aplikasi, { total_bobot: 0, hasFatal: false, errors: [] });
      }
      const curr = errorMap.get(log.id_aplikasi);
      if (log.master_error) {
        const bobot = log.master_error.bobot_error != null
          ? parseFloat(log.master_error.bobot_error.toString()) : 0;
        const isFatal =
          (log.master_error.kategori || "").toLowerCase().includes("fatal") || bobot >= 1.0;

        curr.total_bobot = parseFloat((curr.total_bobot + bobot).toFixed(2));
        if (isFatal) curr.hasFatal = true;
        curr.errors.push({
          id_error:   log.master_error.id,
          nama_field: log.master_error.nama_field,
          kategori:   log.master_error.kategori,
          bobot,
        });
      }
    }

    // Gabungkan & hitung status
    let data = headers.map((h) => {
      const errData = errorMap.get(h.id_aplikasi) || { total_bobot: 0, hasFatal: false, errors: [] };
      let appStatus;
      if (errData.hasFatal)            appStatus = "Fatal";
      else if (errData.total_bobot > 0) appStatus = "Minor";
      else                              appStatus = "Lolos";

      return {
        id_aplikasi:   h.id_aplikasi,
        nama_aplikan:  h.nama_aplikan,
        nama_user_ide: h.nama_user_ide,
        cas_sas:       h.cas_sas,
        channel:       h.channel,
        tanggal_input: h.tanggal_input,
        analis:        h.user?.username || null,
        total_bobot:   errData.total_bobot,
        jumlah_error:  errData.errors.length,
        status:        appStatus,
        errors:        errData.errors,
      };
    });

    // Filter status jika ada
    if (status) {
      const statusNorm = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      data = data.filter((d) => d.status === statusNorm);
    }

    const namaBulan = new Date(tahun, bulan - 1, 1)
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    res.json({
      periode:        namaBulan,
      bulan,
      tahun,
      total_aplikasi: data.length,
      data,
    });
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
  getRekapBulanan,
  getRekapBulananDetail,
};
