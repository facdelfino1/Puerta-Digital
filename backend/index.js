require('dotenv').config();
const express = require('express');
const cors = require('cors');
const providersRouter = require('./routes/providers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:3000', // Cambia si tu frontend está en otro origen
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos para PDFs
app.use('/uploads', express.static('uploads'));

// Montar el router de proveedores
app.use('/providers', providersRouter);

app.get('/', (req, res) => {
  res.send('API de Control de Acceso funcionando');
});

