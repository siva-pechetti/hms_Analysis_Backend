const bcrypt = require("bcrypt");
const db = require("../config/db");
require("dotenv").config();
const crypto = require("crypto");
const { sendResetEmail } = require("../services/emailService");

exports.signUp = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashed]
    );

    return res.status(201).json({ message: "User created" });

  } catch (err) {
    console.log("SIGNUP ERROR:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Username or email already exists" });
    }

    return res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [users] = await db.execute("select * from users where email =?", [email]);
    if (!users.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = DataTransfer.now() + 15 * 60 * 1000;
    await db.execute(`update users set reset_token=?,reset_token_expiry=? where email= ?`, [token, expiry, email]);
    const resetLink = `http://localhost:5173/reset-password/${token}`;
    res.json({
      message: "Reset link sent",
    });
 }
 catch(error){
  console.log(error);
  res.status(500).json({
    message:"server error"
  })
 }
}


