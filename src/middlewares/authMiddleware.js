const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");

  // Cek header Authorization ada atau tidak
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Akses Ditolak. Token tidak ditemukan" });
  }

  // Header Authorization format: Bearer <token>
  // Kita perlu memisahkannya untuk mendapatkan token murni
  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token Tidak Valid" });
  }
};

module.exports = verifyToken;
