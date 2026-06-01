require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Trust proxy (Railway / reverse proxy) ─────────────────
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos. Inténtalo en 15 minutos.' } });

app.use(limiter);
app.use('/auth', authLimiter);

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ─────────────────────────────────────────────────
app.use('/auth', require('./src/routes/auth'));
app.use('/api', require('./src/routes/api'));

// ── Page routes ────────────────────────────────────────────
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register',  (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/verify',    (req, res) => res.sendFile(path.join(__dirname, 'public/verify.html')));
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

// ── MongoDB ────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    // Start Discord bot only if token provided
    if (process.env.DISCORD_TOKEN) {
      require('./bot/index');
    } else {
      console.warn('⚠️  DISCORD_TOKEN no configurado — bot desactivado');
    }
  })
  .catch(err => console.error('❌ Error MongoDB:', err));

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.redirect('/');
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛡️  SentinelBot Dashboard corriendo en puerto ${PORT}`);
});
