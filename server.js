const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    mensaje: "Among Us Admin API funcionando 🚀"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API funcionando en el puerto ${PORT}`);
});
