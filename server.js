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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new Error("El archivo debe ser una imagen.")
      );
    }

    cb(null, true);
  }
});

// ==========================================
// INICIO
// ==========================================

app.get("/", (req, res) => {
  res.json({
    mensaje:
      "API de Among Us funcionando correctamente.",
    estado: "online"
  });
});

// ==========================================
// BASE DE DATOS
// ==========================================

async function iniciarBaseDeDatos() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS integrantes (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        rol TEXT,
        presentacion TEXT,
        foto TEXT
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_staff (
        id BIGSERIAL PRIMARY KEY,
        cuenta_id BIGINT NOT NULL,
        usuario TEXT NOT NULL,
        nombre_visible TEXT NOT NULL,
        motivo TEXT NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado TEXT DEFAULT 'Pendiente',

        CONSTRAINT fk_solicitud_cuenta
        FOREIGN KEY (cuenta_id)
        REFERENCES cuentas(id)
        ON DELETE CASCADE
      )
    `);

    console.log(
      "Base de datos preparada correctamente."
    );
  } catch (error) {
    console.error(
      "Error al preparar la base de datos:",
      error
    );
  }
}

iniciarBaseDeDatos();

// ==========================================
// INTEGRANTES
// ==========================================

// Obtener todos
app.get("/integrantes", async (req, res) => {
  try {
    const resultado = await pool.query(
      `
      SELECT *
      FROM integrantes
      ORDER BY id ASC
      `
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error al obtener los integrantes."
    });
  }
});

// Obtener uno
app.get(
  "/integrantes/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      const resultado = await pool.query(
        `
        SELECT *
        FROM integrantes
        WHERE id = $1
        `,
        [id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({
          error:
            "Integrante no encontrado."
        });
      }

      res.json(resultado.rows[0]);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Error al obtener el integrante."
      });
    }
  }
);

// Crear
app.post(
  "/integrantes",
  async (req, res) => {
    try {
      const {
        nombre,
        rol,
        presentacion,
        foto
      } = req.body;

      if (!nombre) {
        return res.status(400).json({
          error:
            "El nombre es obligatorio."
        });
      }

      const resultado = await pool.query(
        `
        INSERT INTO integrantes
        (
          nombre,
          rol,
          presentacion,
          foto
        )
        VALUES
        ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          nombre,
          rol || "",
          presentacion || "",
          foto || ""
        ]
      );

      res.status(201).json(
        resultado.rows[0]
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Error al crear el integrante."
      });
    }
  }
);

// Actualizar
app.put(
  "/integrantes/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        nombre,
        rol,
        presentacion,
        foto
      } = req.body;

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
          rol || "",
          presentacion || "",
          foto || "",
          id
        ]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({
          error:
            "Integrante no encontrado."
        });
      }

      res.json(resultado.rows[0]);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Error al actualizar el integrante."
      });
    }
  }
);

// Eliminar
app.delete(
  "/integrantes/:id",
  async (req, res) => {
    try {
      const { id } = req.params;

      const resultado = await pool.query(
        `
        DELETE FROM integrantes
        WHERE id = $1
        RETURNING *
        `,
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
          "Error al eliminar el integrante."
      });
    }
  }
);

// ==========================================
// REGISTRO DE CUENTAS
// ==========================================

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

      if (
        !usuario ||
        !nombreVisible ||
        !contrasena ||
        !foto
      ) {
        return res.status(400).json({
          error:
            "Todos los campos son obligatorios."
        });
      }

      if (
        !foto.mimetype.startsWith("image/")
      ) {
        return res.status(400).json({
          error:
            "La foto debe ser una imagen."
        });
      }

      const usuarioExistente =
        await pool.query(
          `
          SELECT id
          FROM cuentas
          WHERE LOWER(usuario) = LOWER($1)
          `,
          [usuario]
        );

      if (
        usuarioExistente.rows.length > 0
      ) {
        return res.status(409).json({
          error:
            "Ese usuario ya existe."
        });
      }

      const contrasenaHash =
        await bcrypt.hash(
          contrasena,
          12
        );

      let extension = "jpg";

      if (
        foto.mimetype ===
        "image/png"
      ) {
        extension = "png";
      } else if (
        foto.mimetype ===
        "image/webp"
      ) {
        extension = "webp";
      } else if (
        foto.mimetype ===
        "image/gif"
      ) {
        extension = "gif";
      } else if (
        foto.mimetype ===
        "image/jpeg"
      ) {
        extension = "jpg";
      }

      const nombreArchivo =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

      const rutaArchivo =
        `perfiles/${nombreArchivo}`;

      const subida =
        await supabase.storage
          .from("profile-images")
          .upload(
            rutaArchivo,
            foto.buffer,
            {
              contentType:
                foto.mimetype,
              upsert: false
            }
          );

      if (subida.error) {
        console.error(
          "Error de Supabase:",
          subida.error
        );

        return res.status(500).json({
          error:
            "No se pudo guardar la foto de perfil."
        });
      }

      const publicUrl =
        supabase.storage
          .from("profile-images")
          .getPublicUrl(
            rutaArchivo
          )
          .data.publicUrl;

      const resultado =
        await pool.query(
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
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            '{}',
            '{}',
            'Pendiente'
          )
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
            publicUrl
          ]
        );

      res.status(201).json({
        mensaje:
          "Solicitud de cuenta creada correctamente.",

        cuenta:
          resultado.rows[0]
      });
    } catch (error) {
      console.error(
        "Error en /registro:",
        error
      );

      res.status(500).json({
        error:
          "Error interno al crear la cuenta."
      });
    }
  }
);

// ==========================================
// CUENTAS PENDIENTES
// ==========================================

// Obtener cuentas pendientes
app.get(
  "/cuentas-pendientes",
  async (req, res) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            id,
            usuario,
            nombre_visible,
            foto,
            roles,
            subroles,
            fecha_creacion,
            estado
          FROM cuentas
          WHERE estado = 'Pendiente'
          ORDER BY fecha_creacion ASC
          `
        );

      res.json(resultado.rows);
    } catch (error) {
      console.error(
        "Error al obtener cuentas pendientes:",
        error
      );

      res.status(500).json({
        error:
          "Error al obtener las cuentas pendientes."
      });
    }
  }
);

// Aceptar cuenta
app.patch(
  "/cuentas/:id/aprobar",
  async (req, res) => {
    try {
      const { id } = req.params;

      const resultado =
        await pool.query(
          `
          UPDATE cuentas
          SET estado = 'Activa'
          WHERE id = $1
          AND estado = 'Pendiente'
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
          [id]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Cuenta no encontrada o ya fue procesada."
        });
      }

      res.json({
        mensaje:
          "Cuenta aceptada correctamente.",

        cuenta:
          resultado.rows[0]
      });
    } catch (error) {
      console.error(
        "Error al aceptar cuenta:",
        error
      );

      res.status(500).json({
        error:
          "Error al aceptar la cuenta."
      });
    }
  }
);

// Rechazar cuenta
app.patch(
  "/cuentas/:id/rechazar",
  async (req, res) => {
    try {
      const { id } = req.params;

      const resultado =
        await pool.query(
          `
          UPDATE cuentas
          SET estado = 'Rechazada'
          WHERE id = $1
          AND estado = 'Pendiente'
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
          [id]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Cuenta no encontrada o ya fue procesada."
        });
      }

      res.json({
        mensaje:
          "Cuenta rechazada correctamente.",

        cuenta:
          resultado.rows[0]
      });
    } catch (error) {
      console.error(
        "Error al rechazar cuenta:",
        error
      );

      res.status(500).json({
        error:
          "Error al rechazar la cuenta."
      });
    }
  }
);

// ==========================================
// SOLICITUDES DE STAFF
// ==========================================

// Crear solicitud
app.post(
  "/solicitudes-staff",
  async (req, res) => {
    try {
      const {
        cuentaId,
        motivo
      } = req.body;

      if (!cuentaId || !motivo) {
        return res.status(400).json({
          error:
            "La cuenta y el motivo son obligatorios."
        });
      }

      const cuenta =
        await pool.query(
          `
          SELECT
            id,
            usuario,
            nombre_visible,
            estado,
            roles
          FROM cuentas
          WHERE id = $1
          `,
          [cuentaId]
        );

      if (
        cuenta.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "La cuenta no existe."
        });
      }

      const datosCuenta =
        cuenta.rows[0];

      if (
        datosCuenta.estado !==
        "Activa"
      ) {
        return res.status(403).json({
          error:
            "La cuenta debe estar activa para solicitar Staff."
        });
      }

      const roles =
        datosCuenta.roles || [];

      if (
        roles.some(
          (rol) =>
            String(rol)
              .toLowerCase() ===
            "staff"
        )
      ) {
        return res.status(409).json({
          error:
            "Esta cuenta ya tiene el rol Staff."
        });
      }

      const solicitudExistente =
        await pool.query(
          `
          SELECT id
          FROM solicitudes_staff
          WHERE cuenta_id = $1
          AND estado = 'Pendiente'
          `,
          [cuentaId]
        );

      if (
        solicitudExistente.rows.length > 0
      ) {
        return res.status(409).json({
          error:
            "Ya tienes una solicitud de Staff pendiente."
        });
      }

      const resultado =
        await pool.query(
          `
          INSERT INTO solicitudes_staff
          (
            cuenta_id,
            usuario,
            nombre_visible,
            motivo,
            estado
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            'Pendiente'
          )
          RETURNING *
          `,
          [
            datosCuenta.id,
            datosCuenta.usuario,
            datosCuenta.nombre_visible,
            motivo
          ]
        );

      res.status(201).json({
        mensaje:
          "Solicitud para Staff enviada correctamente.",

        solicitud:
          resultado.rows[0]
      });
    } catch (error) {
      console.error(
        "Error en /solicitudes-staff:",
        error
      );

      res.status(500).json({
        error:
          "Error al crear la solicitud."
      });
    }
  }
);

// Obtener solicitudes Staff
app.get(
  "/solicitudes-staff",
  async (req, res) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            id,
            cuenta_id,
            usuario,
            nombre_visible,
            motivo,
            fecha_creacion,
            estado
          FROM solicitudes_staff
          ORDER BY fecha_creacion DESC
          `
        );

      res.json(resultado.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Error al obtener las solicitudes."
      });
    }
  }
);

// Aceptar solicitud Staff
app.patch(
  "/solicitudes-staff/:id/aprobar",
  async (req, res) => {
    const cliente =
      await pool.connect();

    try {
      const { id } = req.params;

      await cliente.query(
        "BEGIN"
      );

      const solicitud =
        await cliente.query(
          `
          SELECT *
          FROM solicitudes_staff
          WHERE id = $1
          FOR UPDATE
          `,
          [id]
        );

      if (
        solicitud.rows.length === 0
      ) {
        await cliente.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Solicitud no encontrada."
        });
      }

      const datos =
        solicitud.rows[0];

      if (
        datos.estado !==
        "Pendiente"
      ) {
        await cliente.query(
          "ROLLBACK"
        );

        return res.status(409).json({
          error:
            "Esta solicitud ya fue procesada."
        });
      }

      await cliente.query(
        `
        UPDATE cuentas
        SET
          roles =
            CASE
              WHEN NOT (
                'Staff' = ANY(roles)
              )
              THEN array_append(
                roles,
                'Staff'
              )
              ELSE roles
            END,

          estado = 'Activa'

        WHERE id = $1
        `,
        [datos.cuenta_id]
      );

      const resultado =
        await cliente.query(
          `
          UPDATE solicitudes_staff
          SET estado = 'Aceptada'
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      await cliente.query(
        "COMMIT"
      );

      res.json({
        mensaje:
          "Solicitud aceptada correctamente.",

        solicitud:
          resultado.rows[0]
      });
    } catch (error) {
      await cliente.query(
        "ROLLBACK"
      );

      console.error(
        "Error al aprobar solicitud:",
        error
      );

      res.status(500).json({
        error:
          "Error al aprobar la solicitud."
      });
    } finally {
      cliente.release();
    }
  }
);

// Rechazar solicitud Staff
app.patch(
  "/solicitudes-staff/:id/rechazar",
  async (req, res) => {
    try {
      const { id } = req.params;

      const resultado =
        await pool.query(
          `
          UPDATE solicitudes_staff
          SET estado = 'Rechazada'
          WHERE id = $1
          AND estado = 'Pendiente'
          RETURNING *
          `,
          [id]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Solicitud no encontrada o ya fue procesada."
        });
      }

      res.json({
        mensaje:
          "Solicitud rechazada correctamente.",

        solicitud:
          resultado.rows[0]
      });
    } catch (error) {
      console.error(
        "Error al rechazar solicitud:",
        error
      );

      res.status(500).json({
        error:
          "Error al rechazar la solicitud."
      });
    }
  }
);

// ==========================================
// ERRORES DE MULTER
// ==========================================

app.use(
  (error, req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          error:
            "La imagen no puede superar los 5 MB."
        });
      }

      return res.status(400).json({
        error:
          "Error al procesar la imagen."
      });
    }

    if (
      error &&
      error.message ===
        "E// ==========================================
// ERRORES GENERALES
// ==========================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Error no controlado:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Error interno del servidor."
    });
  }
);// ==========================================
// SERVIDOR
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `API funcionando en el puerto ${PORT}`
    );
  }
);
