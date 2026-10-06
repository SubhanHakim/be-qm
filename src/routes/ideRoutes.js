const express = require("express");
const router = express.Router();

const {
  getIdeParameters,
  submitIdeCek,
  getIdeReport,
  getIdeReportDetail,
  updateIdeReport,
  getAplikasiHeader,
} = require("../controllers/ideController");
const verifyToken = require("../middlewares/authMiddleware");

// Endpoint GET: Daftar semua parameter/field error IDE
router.get("/parameters", verifyToken, getIdeParameters);

// Endpoint POST: Submit hasil ceklis (termasuk nama aplikan, user IDE, CAS/SAS, channel)
router.post("/submit", verifyToken, submitIdeCek);

// Endpoint GET: Ringkasan laporan semua aplikasi
router.get("/report", verifyToken, getIdeReport);

// Endpoint GET: Detail pemeriksaan satu aplikasi (termasuk data header)
router.get("/report/:id_aplikasi", verifyToken, getIdeReportDetail);

// Endpoint PUT: Edit/update temuan + data header aplikasi
router.put("/report/:id_aplikasi", verifyToken, updateIdeReport);
router.put("/report", verifyToken, updateIdeReport);

// Endpoint GET: Ambil data header saja (untuk prefill form edit)
router.get("/header/:id_aplikasi", verifyToken, getAplikasiHeader);

module.exports = router;

