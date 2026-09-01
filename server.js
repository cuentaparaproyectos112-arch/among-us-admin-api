const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

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
    console.error("Error al conectar con la base de datos:", error);
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
        error: "Nombre, rol y foto son obligatorios."
      });
    }

    const resultado = await pool.query(
      `INSERT INTO integrantes
      (nombre, rol, presentacion, foto)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        nombre,
        rol,
        presentacion || "",
        foto
      ]
    );

    res.status(201).json(resultado.rows[0]);

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
        error: "Nombre, rol y foto son obligatorios."
      });
    }

    const resultado = await pool.query(
      `UPDATE integrantes
      SET nombre = $1,
          rol = $2,
          presentacion = $3,
          foto = $4
      WHERE id = $5
      RETURNING *`,
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
        error: "Integrante no encontrado."
      });
    }

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error al editar integrante."
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
        error: "Integrante no encontrado."
      });
    }

    res.json({
      mensaje: "Integrante eliminado correctamente."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error al eliminar integrante."
    });
  }
});

/* =========================
SERVIDOR
========================= */

async function iniciarServidor() {
  await iniciarBaseDeDatos();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API funcionando en el puerto ${PORT}`);
  });
}

iniciarServidor();
