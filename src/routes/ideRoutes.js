const express = require("express");
const router = express.Router();

// Memanggil kedua fungsi dari controller
const {
  getIdeParameters,
  submitIdeCek,
  getIdeReport,
  getIdeReportDetail,
  updateIdeReport,
} = require("../controllers/ideController");
const verifyToken = require("../middlewares/authMiddleware");

// Endpoint GET: http://localhost:5000/api/ide/parameters
router.get("/parameters", verifyToken, getIdeParameters);

// Endpoint POST: http://localhost:5000/api/ide/submit
router.post("/submit", verifyToken, submitIdeCek);

// Endpoint GET: http://localhost:5000/api/ide/report (Ringkasan / Rekapan per Aplikasi)
router.get("/report", verifyToken, getIdeReport);

// Endpoint GET: http://localhost:5000/api/ide/report/:id_aplikasi (Detail Pemeriksaan Aplikasi)
router.get("/report/:id_aplikasi", verifyToken, getIdeReportDetail);

// Endpoint PUT: http://localhost:5000/api/ide/report/:id_aplikasi (Edit / Update Temuan Aplikasi)
router.put("/report/:id_aplikasi", verifyToken, updateIdeReport);
router.put("/report", verifyToken, updateIdeReport);

module.exports = router;
