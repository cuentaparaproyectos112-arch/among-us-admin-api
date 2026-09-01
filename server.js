const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
BASE DE DATOS
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =========================
SUPABASE
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/* =========================
SUBIDA DE IMÁGENES
========================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes."));
    }

    cb(null, true);
  }
});

/* =========================
CREAR TABLAS
========================= */

async function iniciarBaseDeDatos() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS integrantes (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL,
        presentacion TEXT DEFAULT '',
        foto TEXT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cuentas (
        id BIGSERIAL PRIMARY KEY,
        usuario TEXT UNIQUE NOT NULL,
        nombre_visible TEXT NOT NULL,
        contrasena_hash TEXT NOT NULL,
        foto TEXT NOT NULL,
        roles TEXT[] DEFAULT '{}',
        subroles TEXT[] DEFAULT '{}',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'Pendiente'
      )
    `);

    console.log("Base de datos conectada correctamente ✅");
    console.log("Tablas verificadas correctamente ✅");

  } catch (error) {
    console.error(
      "Error al conectar con la base de datos:",
      error
    );
  }
}

/* =========================
INICIO
========================= */

app.get("/", (req, res) => {
  res.json({
    mensaje: "Among Us Admin API funcionando 🚀"
  });
});

/* =========================
REGISTRO DE CUENTA
========================= */

app.post(
  "/registro",
  upload.single("foto"),
  async (req, res) => {

    try {
      const {
        usuario,
        nombreVisible,
        contrasena
      } = req.body;

      const foto = req.file;

      /* =========================
      VALIDAR DATOS
      ========================= */

      if (!usuario || !nombreVisible || !contrasena || !foto) {
        return res.status(400).json({
          error: "Usuario, nombre visible, contraseña y foto son obligatorios."
        });
      }

      /* =========================
      VALIDAR IMAGEN
      ========================= */

      if (!foto.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: "El archivo debe ser una imagen."
        });
      }

      if (foto.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: "La imagen no puede superar los 5 MB."
        });
      }

      /* =========================
      COMPROBAR USUARIO
      ========================= */

      const usuarioExistente = await pool.query(
        "SELECT id FROM cuentas WHERE usuario = $1",
        [usuario]
      );

      if (usuarioExistente.rows.length > 0) {
        return res.status(409).json({
          error: "Ese usuario ya existe."
        });
      }

      /* =========================
      HASH DE CONTRASEÑA
      ========================= */

      const contrasenaHash = await bcrypt.hash(
        contrasena,
        12
      );

      /* =========================
      NOMBRE DE ARCHIVO
      ========================= */

      const extension =
        foto.mimetype.split("/")[1] || "jpg";

      const nombreArchivo =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2
