const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const { Server, Event } = require('../models/Server');
const User = require('../models/User');

// All API routes require authentication
router.use(authMiddleware);

// ── GET /api/servers ───────────────────────────────────────
router.get('/servers', async (req, res) => {
  try {
    const servers = await Server.find({ ownerId: req.user._id });
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo servidores.' });
  }
});

// ── GET /api/server/:guildId ───────────────────────────────
router.get('/server/:guildId', async (req, res) => {
  try {
    const server = await Server.findOne({
      guildId: req.params.guildId,
      ownerId: req.user._id,
    });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo servidor.' });
  }
});

// ── PATCH /api/server/:guildId/settings ───────────────────
router.patch('/server/:guildId/settings', async (req, res) => {
  try {
    const server = await Server.findOne({
      guildId: req.params.guildId,
      ownerId: req.user._id,
    });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });

    const allowed = [
      'logChannelId', 'alertChannelId', 'antiNuke', 'antiBotAdd',
      'antiMassBan', 'antiMassKick', 'antiChannelDelete', 'antiRoleDelete',
      'antiWebhookCreate', 'antiPermChange', 'banThreshold', 'kickThreshold',
      'channelDeleteThreshold', 'roleDeleteThreshold', 'punishmentAction',
      'notifyOwner',
    ];

    allowed.forEach(key => {
      if (req.body[key] !== undefined) {
        server.settings[key] = req.body[key];
      }
    });

    await server.save();
    res.json({ message: 'Configuración actualizada.', settings: server.settings });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando configuración.' });
  }
});

// ── GET /api/server/:guildId/events ───────────────────────
router.get('/server/:guildId/events', async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, type } = req.query;
    const server = await Server.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });

    const filter = { guildId: req.params.guildId };
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const events = await Event.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Event.countDocuments(filter);

    res.json({ events, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo eventos.' });
  }
});

// ── GET /api/server/:guildId/stats ────────────────────────
router.get('/server/:guildId/stats', async (req, res) => {
  try {
    const server = await Server.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [totalEvents, todayEvents, criticalEvents, weekEvents] = await Promise.all([
      Event.countDocuments({ guildId: req.params.guildId }),
      Event.countDocuments({ guildId: req.params.guildId, timestamp: { $gte: today } }),
      Event.countDocuments({ guildId: req.params.guildId, severity: 'critical' }),
      Event.countDocuments({ guildId: req.params.guildId, timestamp: { $gte: weekAgo } }),
    ]);

    // Events per day for last 7 days
    const eventsPerDay = await Event.aggregate([
      { $match: { guildId: req.params.guildId, timestamp: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ totalEvents, todayEvents, criticalEvents, weekEvents, eventsPerDay, server });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo estadísticas.' });
  }
});

// ── POST /api/server/:guildId/whitelist ───────────────────
router.post('/server/:guildId/whitelist', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId es requerido.' });

    const server = await Server.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });

    if (!server.settings.whitelist.includes(userId)) {
      server.settings.whitelist.push(userId);
      await server.save();
    }

    res.json({ message: 'Usuario añadido a la whitelist.', whitelist: server.settings.whitelist });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando whitelist.' });
  }
});

// ── DELETE /api/server/:guildId/whitelist/:userId ─────────
router.delete('/server/:guildId/whitelist/:userId', async (req, res) => {
  try {
    const server = await Server.findOne({ guildId: req.params.guildId, ownerId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado.' });

    server.settings.whitelist = server.settings.whitelist.filter(id => id !== req.params.userId);
    await server.save();

    res.json({ message: 'Usuario removido de la whitelist.', whitelist: server.settings.whitelist });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando whitelist.' });
  }
});

// ── GET /api/dashboard/overview ───────────────────────────
router.get('/dashboard/overview', async (req, res) => {
  try {
    const servers = await Server.find({ ownerId: req.user._id });
    const guildIds = servers.map(s => s.guildId);

    const [totalEvents, todayEvents] = await Promise.all([
      Event.countDocuments({ guildId: { $in: guildIds } }),
      Event.countDocuments({
        guildId: { $in: guildIds },
        timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    res.json({
      serversCount: servers.length,
      totalEvents,
      todayEvents,
      servers: servers.map(s => ({
        guildId: s.guildId,
        name: s.name,
        icon: s.icon,
        memberCount: s.memberCount,
        isActive: s.isActive,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo overview.' });
  }
});

module.exports = router;
