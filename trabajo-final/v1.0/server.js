const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Sirve estáticos desde la carpeta actual
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});