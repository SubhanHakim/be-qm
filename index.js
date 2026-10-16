const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Memanggil koneksi database dari folder config
const pool = require("./src/config/db");

const ideRoutes = require("./src/routes/ideRoutes");
const authRoutes = require("./src/routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Route Sementara
app.get("/api/ide-parameters", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM Master_Error_IDE ORDER BY id ASC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

app.use("/api/ide", ideRoutes);
app.use("/api/auth", authRoutes);
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.send("OK");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend berjalan di http://localhost:${PORT}`);
});
