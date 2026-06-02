const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── POST /auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener entre 3 y 32 caracteres.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'El correo electrónico no es válido.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Check duplicates
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email.toLowerCase()) {
        return res.status(409).json({ error: 'Este correo ya está registrado.' });
      }
      return res.status(409).json({ error: 'Este nombre de usuario ya existe.' });
    }

    // Create user — verified automatically
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      isVerified: true,
    });
    await user.save();

    res.status(201).json({
      message: '✅ Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      email: user.email,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al crear la cuenta. Inténtalo de nuevo.' });
  }
});

// ── POST /auth/login ───────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    }

    // Find by email or username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email.trim() },
      ],
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Debes verificar tu correo antes de iniciar sesión.',
        code: 'NOT_VERIFIED',
      });
    }

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, cookieOpts);

    res.json({
      message: '¡Bienvenido!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        plan: user.plan,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// ── POST /auth/logout ──────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada.' });
});

// ── GET /auth/me ───────────────────────────────────────────
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    plan: req.user.plan,
    avatar: req.user.avatar,
    servers: req.user.servers,
    createdAt: req.user.createdAt,
    lastLogin: req.user.lastLogin,
  });
});

module.exports = router;
