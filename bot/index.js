const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Server, Event } = require('../src/models/Server');
const antiNuke = require('./handlers/antiNuke');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations,
  ],
  partials: [Partials.GuildMember],
});

// ── Ready ──────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: '🛡️ Protegiendo servidores', type: 3 }],
    status: 'online',
  });
});

// ── Guild Join ─────────────────────────────────────────────
client.on('guildCreate', async (guild) => {
  console.log(`➕ Bot añadido a: ${guild.name} (${guild.id})`);
  try {
    const existing = await Server.findOne({ guildId: guild.id });
    if (!existing) {
      await Server.create({
        guildId: guild.id,
        ownerId: null, // Linked when owner registers
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
      });
    }

    // Send welcome embed to system channel
    const sysChannel = guild.systemChannel;
    if (sysChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x00d4ff)
        .setTitle('🛡️ SentinelBot — Sistema Anti-Nuke Activado')
        .setDescription('Gracias por añadirme a tu servidor. La protección anti-nuke está **activa**.')
        .addFields(
          { name: '⚙️ Configurar', value: 'Visita [el dashboard](https://sentinelbot.app/dashboard) para configurar la protección.', inline: true },
          { name: '📋 Ayuda', value: 'Usa `/help` para ver todos los comandos disponibles.', inline: true }
        )
        .setFooter({ text: 'SentinelBot — Protección 24/7' })
        .setTimestamp();
      sysChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Error en guildCreate:', err);
  }
});

// ── Anti-Nuke Events ───────────────────────────────────────
client.on('guildBanAdd', (ban) => antiNuke.onBan(client, ban));
client.on('guildMemberRemove', (member) => antiNuke.onKick(client, member));
client.on('channelDelete', (channel) => antiNuke.onChannelDelete(client, channel));
client.on('roleDelete', (role) => antiNuke.onRoleDelete(client, role));
client.on('webhookUpdate', (channel) => antiNuke.onWebhook(client, channel));
client.on('guildMemberAdd', (member) => antiNuke.onMemberAdd(client, member));

// ── Error handling ─────────────────────────────────────────
client.on('error', (err) => console.error('❌ Discord client error:', err));
process.on('unhandledRejection', (err) => console.error('❌ Unhandled rejection:', err));

// ── Login ──────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Error al conectar bot:', err.message);
});

module.exports = client;
