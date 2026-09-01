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
          error:
            "Usuario, nombre visible, contraseña y foto son obligatorios."
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
      NOMBRE DEL ARCHIVO
      ========================= */

      const extension =
        foto.mimetype.split("/")[1] || "jpg";

      const nombreArchivo =
        `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

      /* =========================
      SUBIR FOTO A SUPABASE
      ========================= */

      const { error: uploadError } =
        await supabase.storage
          .from("profile-images")
          .upload(
            nombreArchivo,
            foto.buffer,
            {
              contentType: foto.mimetype,
              upsert: false
            }
          );

      if (uploadError) {
        console.error(
          "Error al subir imagen:",
          uploadError
        );

        return res.status(500).json({
          error:
            "No se pudo subir la foto de perfil."
        });
      }

      /* =========================
      OBTENER URL DE LA FOTO
      ========================= */

      const { data: publicUrlData } =
        supabase.storage
          .from("profile-images")
          .getPublicUrl(nombreArchivo);

      const fotoUrl = publicUrlData.publicUrl;

      /* =========================
      CREAR CUENTA
      ========================= */

      const resultado = await pool.query(
        `
        INSERT INTO cuentas
        (
          usuario,
          nombre_visible,
          contrasena_hash,
          foto,
          roles,
          subroles,
          estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          usuario,
          nombre_visible,
          foto,
          roles,
          subroles,
          fecha_creacion,
          estado
        `,
        [
          usuario,
          nombreVisible,
          contrasenaHash,
          fotoUrl,
          [],
          [],
          "Pendiente"
        ]
      );

      /* =========================
      RESPUESTA
      ========================= */

      res.status(201).json({
        mensaje:
          "Solicitud de cuenta enviada correctamente.",
        cuenta: resultado.rows[0]
      });

    } catch (error) {
      console.error(
        "Error en el registro:",
        error
      );

      res.status(500).json({
        error:
          "Error interno al crear la cuenta."
      });
    }
  }
);

/* =========================
OBTENER INTEGRANTES
========================= */

app.get("/integrantes", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM integrantes ORDER BY id ASC"
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error al obtener integrantes."
    });
  }
});

/* =========================
CREAR INTEGRANTE
========================= */

app.post("/integrantes", async (req, res) => {
  try {
    const {
      nombre,
      rol,
      presentacion,
      foto
    } = req.body;

    if (!nombre || !rol || !foto) {
      return res.status(400).json({
        error:
          "Nombre, rol y foto son obligatorios."
      });
    }

    const resultado = await pool.query(
      `
      INSERT INTO integrantes
      (nombre, rol, presentacion, foto)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        nombre,
        rol,
        presentacion || "",
        foto
      ]
    );

    res.status(201).json(
      resultado.rows[0]
    );

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error al crear integrante."
    });
  }
});

/* =========================
EDITAR INTEGRANTE
========================= */

app.put("/integrantes/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const {
      nombre,
      rol,
      presentacion,
      foto
    } = req.body;

    if (!nombre || !rol || !foto) {
      return res.status(400).json({
        error:
          "Nombre, rol y foto son obligatorios."
      });
    }

    const resultado = await pool.query(
      `
      UPDATE integrantes
      SET
        nombre = $1,
        rol = $2,
        presentacion = $3,
        foto = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        nombre,
        rol,
        presentacion || "",
        foto,
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error:
          "Integrante no encontrado."
      });
    }

    res.json(
      resultado.rows[0]
    );

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error al editar integrante."
    });
  }
});

/* =========================
ELIMINAR INTEGRANTE
========================= */

app.delete("/integrantes/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const resultado = await pool.query(
      "DELETE FROM integrantes WHERE id = $1 RETURNING *",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error:
          "Integrante no encontrado."
      });
    }

    res.json({
      mensaje:
        "Integrante eliminado correctamente."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error al eliminar integrante."
    });
  }
});

/* =========================
ERRORES DE MULTER
========================= */

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error:
          "La imagen no puede superar los 5 MB."
      });
    }
  }

  if (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  next();
});

/* =========================
SERVIDOR
========================= */

async function iniciarServidor() {
  await iniciarBaseDeDatos();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `API funcionando en el puerto ${PORT}`
      );
    }
  );
}

iniciarServidor();
