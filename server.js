const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;


/* =========================
   DATOS
========================= */

let integrantes = [];


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

app.get("/integrantes", (req, res) => {
  res.json(integrantes);
});


/* =========================
   CREAR INTEGRANTE
========================= */

app.post("/integrantes", (req, res) => {

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

  const nuevoIntegrante = {
    id: Date.now(),
    nombre,
    rol,
    presentacion: presentacion || "",
    foto
  };

  integrantes.push(nuevoIntegrante);

  res.status(201).json(nuevoIntegrante);
});


/* =========================
   EDITAR INTEGRANTE
========================= */

app.put("/integrantes/:id", (req, res) => {

  const id = Number(req.params.id);

  const indice = integrantes.findIndex(
    (integrante) => integrante.id === id
  );

  if (indice === -1) {
    return res.status(404).json({
      error: "Integrante no encontrado."
    });
  }

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

  integrantes[indice] = {
    ...integrantes[indice],
    nombre,
    rol,
    presentacion: presentacion || "",
    foto
  };

  res.json(integrantes[indice]);
});


/* =========================
   ELIMINAR INTEGRANTE
========================= */

app.delete("/integrantes/:id", (req, res) => {

  const id = Number(req.params.id);

  const integranteExiste = integrantes.some(
    (integrante) => integrante.id === id
  );

  if (!integranteExiste) {
    return res.status(404).json({
      error: "Integrante no encontrado."
    });
  }

  integrantes = integrantes.filter(
    (integrante) => integrante.id !== id
  );

  res.json({
    mensaje: "Integrante eliminado correctamente."
  });
});


/* =========================
   SERVIDOR
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API funcionando en el puerto ${PORT}`);
});
