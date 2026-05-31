const mongoose = require('mongoose');

// ── Server Model ───────────────────────────────────────────
const serverSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: { type: String, default: 'Servidor Desconocido' },
  icon: { type: String, default: null },
  memberCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },

  settings: {
    logChannelId: { type: String, default: null },
    alertChannelId: { type: String, default: null },

    // Protection toggles
    antiNuke: { type: Boolean, default: true },
    antiBotAdd: { type: Boolean, default: true },
    antiMassBan: { type: Boolean, default: true },
    antiMassKick: { type: Boolean, default: true },
    antiChannelDelete: { type: Boolean, default: true },
    antiRoleDelete: { type: Boolean, default: true },
    antiWebhookCreate: { type: Boolean, default: true },
    antiPermChange: { type: Boolean, default: false },

    // Thresholds (actions per 10 seconds)
    banThreshold: { type: Number, default: 3 },
    kickThreshold: { type: Number, default: 3 },
    channelDeleteThreshold: { type: Number, default: 3 },
    roleDeleteThreshold: { type: Number, default: 3 },

    // Actions
    punishmentAction: {
      type: String,
      enum: ['kick', 'ban', 'strip_roles', 'timeout'],
      default: 'strip_roles',
    },
    notifyOwner: { type: Boolean, default: true },

    // Whitelist
    whitelist: [{ type: String }], // User IDs
    whitelistRoles: [{ type: String }], // Role IDs
  },

  joinedAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
});

// ── Security Event Model ────────────────────────────────────
const eventSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },

  type: {
    type: String,
    enum: [
      'MASS_BAN', 'MASS_KICK', 'CHANNEL_DELETE', 'ROLE_DELETE',
      'WEBHOOK_CREATE', 'BOT_ADD', 'PERM_CHANGE', 'NUKE_ATTEMPT',
      'WHITELIST_BYPASS', 'BOT_JOINED', 'SUSPICIOUS_ACTIVITY'
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },

  targetUserId: { type: String, default: null },
  targetUsername: { type: String, default: 'Desconocido' },
  targetAvatar: { type: String, default: null },

  actionTaken: { type: String, default: 'Ninguna' },
  details: { type: String, default: '' },
  extra: { type: mongoose.Schema.Types.Mixed, default: {} },

  resolved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true },
});

const Server = mongoose.model('Server', serverSchema);
const Event = mongoose.model('Event', eventSchema);

module.exports = { Server, Event };
