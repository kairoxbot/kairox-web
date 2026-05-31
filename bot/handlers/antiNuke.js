const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { Server, Event } = require('../../src/models/Server');

// ── Action tracker (in-memory) ─────────────────────────────
const tracker = new Map(); // Map<guildId, Map<userId, { bans: [], kicks: [], channelDeletes: [], roleDeletes: [] }>>

const WINDOW = 10_000; // 10 seconds

function getTracker(guildId, userId) {
  if (!tracker.has(guildId)) tracker.set(guildId, new Map());
  const guild = tracker.get(guildId);
  if (!guild.has(userId)) {
    guild.set(userId, { bans: [], kicks: [], channelDeletes: [], roleDeletes: [], webhooks: [] });
  }
  return guild.get(userId);
}

function recordAction(guildId, userId, type) {
  const user = getTracker(guildId, userId);
  const now = Date.now();
  user[type].push(now);
  user[type] = user[type].filter(t => now - t < WINDOW);
  return user[type].length;
}

// ── Get server settings ────────────────────────────────────
async function getSettings(guildId) {
  return Server.findOne({ guildId }).lean();
}

// ── Send alert embed ───────────────────────────────────────
async function sendAlert(guild, channelId, embed) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
}

// ── Log event to DB ────────────────────────────────────────
async function logEvent(guildId, type, severity, targetUserId, targetUsername, actionTaken, details) {
  try {
    const srv = await Server.findOne({ guildId });
    await Event.create({
      guildId,
      serverId: srv?._id,
      type, severity,
      targetUserId, targetUsername,
      actionTaken, details,
    });
  } catch (err) {
    console.error('Error logging event:', err);
  }
}

// ── Get audit log executor ────────────────────────────────
async function getExecutor(guild, type) {
  try {
    await new Promise(r => setTimeout(r, 1000)); // Wait for audit log
    const logs = await guild.fetchAuditLogs({ limit: 1, type });
    const entry = logs.entries.first();
    if (entry && Date.now() - entry.createdTimestamp < 5000) {
      return entry.executor;
    }
  } catch {}
  return null;
}

// ── Punish user ───────────────────────────────────────────
async function punishUser(guild, userId, settings) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return 'No se pudo obtener al miembro';

  // Don't punish the server owner or bots (except the violating bot)
  if (member.id === guild.ownerId) return 'Saltado (dueño del servidor)';

  const action = settings?.settings?.punishmentAction || 'strip_roles';

  try {
    switch (action) {
      case 'ban':
        await guild.members.ban(userId, { reason: 'SentinelBot: Anti-Nuke activado' });
        return 'Usuario baneado';
      case 'kick':
        await member.kick('SentinelBot: Anti-Nuke activado');
        return 'Usuario expulsado';
      case 'timeout':
        await member.timeout(60 * 60 * 1000, 'SentinelBot: Anti-Nuke activado');
        return 'Usuario silenciado por 1 hora';
      case 'strip_roles':
      default:
        await member.roles.set([], 'SentinelBot: Anti-Nuke activado');
        return 'Roles removidos';
    }
  } catch (err) {
    return `Error al sancionar: ${err.message}`;
  }
}

// ── Build alert embed ──────────────────────────────────────
function buildEmbed(title, description, severity, userId, username, action) {
  const colors = { critical: 0xff0000, high: 0xff6600, medium: 0xffbb00, low: 0x00d4ff };
  return new EmbedBuilder()
    .setColor(colors[severity] || 0xff0000)
    .setTitle(`🚨 ${title}`)
    .setDescription(description)
    .addFields(
      { name: '👤 Usuario', value: `<@${userId}> (${username})`, inline: true },
      { name: '⚡ Acción', value: action, inline: true },
    )
    .setFooter({ text: 'SentinelBot Anti-Nuke' })
    .setTimestamp();
}

// ── onBan ──────────────────────────────────────────────────
async function onBan(client, ban) {
  const { guild } = ban;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiMassBan) return;

  const executor = await getExecutor(guild, AuditLogEvent.MemberBanAdd);
  if (!executor || executor.id === client.user.id) return;

  // Check whitelist
  if (settings.settings.whitelist?.includes(executor.id)) return;

  const count = recordAction(guild.id, executor.id, 'bans');
  const threshold = settings.settings.banThreshold || 3;

  if (count >= threshold) {
    const action = await punishUser(guild, executor.id, settings);
    const embed = buildEmbed(
      'MASS BAN DETECTADO',
      `**${executor.username}** realizó **${count} bans** en menos de 10 segundos.`,
      'critical', executor.id, executor.username, action
    );

    await sendAlert(guild, settings.settings.alertChannelId, embed);
    await logEvent(guild.id, 'MASS_BAN', 'critical', executor.id, executor.username, action, `${count} bans en <10s`);

    // Notify owner
    if (settings.settings.notifyOwner) {
      const owner = await guild.fetchOwner().catch(() => null);
      owner?.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

// ── onKick ─────────────────────────────────────────────────
async function onKick(client, member) {
  const { guild } = member;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiMassKick) return;

  const executor = await getExecutor(guild, AuditLogEvent.MemberKick);
  if (!executor || executor.id === client.user.id) return;
  if (settings.settings.whitelist?.includes(executor.id)) return;

  const count = recordAction(guild.id, executor.id, 'kicks');
  const threshold = settings.settings.kickThreshold || 3;

  if (count >= threshold) {
    const action = await punishUser(guild, executor.id, settings);
    const embed = buildEmbed(
      'MASS KICK DETECTADO',
      `**${executor.username}** expulsó a **${count} usuarios** en menos de 10 segundos.`,
      'critical', executor.id, executor.username, action
    );

    await sendAlert(guild, settings.settings.alertChannelId, embed);
    await logEvent(guild.id, 'MASS_KICK', 'critical', executor.id, executor.username, action, `${count} kicks en <10s`);
  }
}

// ── onChannelDelete ────────────────────────────────────────
async function onChannelDelete(client, channel) {
  const { guild } = channel;
  if (!guild) return;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiChannelDelete) return;

  const executor = await getExecutor(guild, AuditLogEvent.ChannelDelete);
  if (!executor || executor.id === client.user.id) return;
  if (settings.settings.whitelist?.includes(executor.id)) return;

  const count = recordAction(guild.id, executor.id, 'channelDeletes');
  const threshold = settings.settings.channelDeleteThreshold || 3;

  if (count >= threshold) {
    const action = await punishUser(guild, executor.id, settings);
    const embed = buildEmbed(
      'ELIMINACIÓN MASIVA DE CANALES',
      `**${executor.username}** eliminó **${count} canales** en menos de 10 segundos.`,
      'critical', executor.id, executor.username, action
    );

    await sendAlert(guild, settings.settings.alertChannelId, embed);
    await logEvent(guild.id, 'CHANNEL_DELETE', 'critical', executor.id, executor.username, action, `${count} canales eliminados en <10s`);
  }
}

// ── onRoleDelete ───────────────────────────────────────────
async function onRoleDelete(client, role) {
  const { guild } = role;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiRoleDelete) return;

  const executor = await getExecutor(guild, AuditLogEvent.RoleDelete);
  if (!executor || executor.id === client.user.id) return;
  if (settings.settings.whitelist?.includes(executor.id)) return;

  const count = recordAction(guild.id, executor.id, 'roleDeletes');
  const threshold = settings.settings.roleDeleteThreshold || 3;

  if (count >= threshold) {
    const action = await punishUser(guild, executor.id, settings);
    const embed = buildEmbed(
      'ELIMINACIÓN MASIVA DE ROLES',
      `**${executor.username}** eliminó **${count} roles** en menos de 10 segundos.`,
      'high', executor.id, executor.username, action
    );

    await sendAlert(guild, settings.settings.alertChannelId, embed);
    await logEvent(guild.id, 'ROLE_DELETE', 'high', executor.id, executor.username, action, `${count} roles eliminados en <10s`);
  }
}

// ── onWebhook ──────────────────────────────────────────────
async function onWebhook(client, channel) {
  const { guild } = channel;
  if (!guild) return;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiWebhookCreate) return;

  const executor = await getExecutor(guild, AuditLogEvent.WebhookCreate);
  if (!executor || executor.id === client.user.id) return;
  if (settings.settings.whitelist?.includes(executor.id)) return;

  const count = recordAction(guild.id, executor.id, 'webhooks');

  if (count >= 2) {
    const action = await punishUser(guild, executor.id, settings);
    const embed = buildEmbed(
      'WEBHOOK SOSPECHOSO CREADO',
      `**${executor.username}** creó múltiples webhooks sospechosamente.`,
      'medium', executor.id, executor.username, action
    );

    await sendAlert(guild, settings.settings.alertChannelId, embed);
    await logEvent(guild.id, 'WEBHOOK_CREATE', 'medium', executor.id, executor.username, action, `${count} webhooks creados`);
  }
}

// ── onMemberAdd (bot detection) ────────────────────────────
async function onMemberAdd(client, member) {
  if (!member.user.bot) return;
  const { guild } = member;
  const settings = await getSettings(guild.id);
  if (!settings?.settings?.antiBotAdd) return;

  const executor = await getExecutor(guild, AuditLogEvent.BotAdd);
  if (!executor || executor.id === client.user.id) return;
  if (settings.settings.whitelist?.includes(executor.id)) return;
  if (executor.id === guild.ownerId) return; // Owner can add bots

  const embed = buildEmbed(
    'BOT AÑADIDO SIN AUTORIZACIÓN',
    `**${executor.username}** añadió el bot **${member.user.tag}** sin autorización.`,
    'high', executor.id, executor.username, 'Alerta enviada al dueño'
  );

  await sendAlert(guild, settings.settings.alertChannelId, embed);
  await logEvent(guild.id, 'BOT_ADD', 'high', executor.id, executor.username, 'Alerta enviada', `Bot añadido: ${member.user.tag}`);
}

module.exports = { onBan, onKick, onChannelDelete, onRoleDelete, onWebhook, onMemberAdd };
