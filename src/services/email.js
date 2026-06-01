const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── Base email template ────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SentinelBot</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Exo+2:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #010c1a; font-family: 'Exo 2', Arial, sans-serif; color: #f0f9ff; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header {
      background: linear-gradient(135deg, #020d20, #041427);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 16px 16px 0 0;
      padding: 40px 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, #00d4ff, #0ea5e9, #00d4ff, transparent);
    }
    .logo-icon { font-size: 52px; display: block; margin-bottom: 14px; filter: drop-shadow(0 0 20px #00d4ff); }
    .logo-title {
      font-family: 'Orbitron', monospace; font-size: 28px; font-weight: 900;
      letter-spacing: 4px; color: #f0f9ff;
    }
    .logo-title span { color: #00d4ff; }
    .logo-sub { color: #64748b; font-size: 13px; margin-top: 6px; letter-spacing: 1px; }
    .body {
      background: #030f1f;
      border: 1px solid rgba(14, 165, 233, 0.12);
      border-top: none;
      padding: 44px 40px;
    }
    .greeting { font-size: 20px; font-weight: 600; color: #e2e8f0; margin-bottom: 16px; }
    .text { color: #94a3b8; font-size: 15px; line-height: 1.7; margin-bottom: 20px; }
    .btn {
      display: inline-block; padding: 15px 40px;
      background: linear-gradient(135deg, #0284c7, #0ea5e9, #00c4f0);
      color: #fff; text-decoration: none;
      font-family: 'Orbitron', monospace; font-size: 13px; font-weight: 700; letter-spacing: 2px;
      border-radius: 10px;
      box-shadow: 0 0 30px rgba(14, 165, 233, 0.4);
    }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .divider { border: none; border-top: 1px solid rgba(14, 165, 233, 0.12); margin: 28px 0; }
    .url-box {
      background: #010c1a; border: 1px solid rgba(14, 165, 233, 0.15);
      border-radius: 8px; padding: 12px 16px;
      font-family: monospace; font-size: 12px; color: #00d4ff;
      word-break: break-all; margin: 16px 0;
    }
    .footer {
      background: #020a16;
      border: 1px solid rgba(14, 165, 233, 0.1);
      border-top: none; border-radius: 0 0 16px 16px;
      padding: 24px 40px; text-align: center;
    }
    .footer p { color: #475569; font-size: 12px; line-height: 1.6; }
    .footer a { color: #0ea5e9; text-decoration: none; }
    .feature-grid { display: flex; gap: 16px; margin: 24px 0; }
    .feature { flex: 1; background: #020d20; border: 1px solid rgba(14,165,233,.1); border-radius: 10px; padding: 16px; text-align: center; }
    .feature .fi { font-size: 24px; display: block; margin-bottom: 8px; }
    .feature .ft { font-size: 12px; color: #64748b; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo-icon">🛡️</span>
      <div class="logo-title">SENTINEL<span>BOT</span></div>
      <div class="logo-sub">SISTEMA DE SEGURIDAD DISCORD</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Este correo fue enviado automáticamente por SentinelBot.<br>
      Si no realizaste esta acción, puedes ignorar este mensaje.<br>
      <a href="${process.env.FRONTEND_URL || '#'}">sentinelbot.app</a> • Protegiendo Discord desde 2024</p>
    </div>
  </div>
</body>
</html>`;

// ── Send verification email ────────────────────────────────
const sendVerificationEmail = async (email, username, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify/${token}`;

  const content = `
    <p class="greeting">¡Bienvenido, ${username}! 👋</p>
    <p class="text">Gracias por registrarte en <strong style="color:#00d4ff">SentinelBot</strong>. Tu cuenta ha sido creada exitosamente. Solo necesitas verificar tu dirección de correo electrónico para comenzar a proteger tus servidores de Discord.</p>

    <div class="feature-grid">
      <div class="feature"><span class="fi">🛡️</span><span class="ft">Anti-Nuke</span></div>
      <div class="feature"><span class="fi">⚡</span><span class="ft">Tiempo Real</span></div>
      <div class="feature"><span class="fi">📊</span><span class="ft">Dashboard</span></div>
    </div>

    <p class="text">Haz clic en el botón para verificar tu cuenta:</p>
    <div class="btn-wrap">
      <a href="${verifyUrl}" class="btn">✓ VERIFICAR CUENTA</a>
    </div>
    <hr class="divider">
    <p class="text" style="font-size:13px">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
    <div class="url-box">${verifyUrl}</div>
    <p class="text" style="font-size:12px; color: #475569;">⏰ Este enlace expira en <strong style="color:#f0f9ff">24 horas</strong>.</p>
  `;

  await transporter.sendMail({
    from: `"SentinelBot 🛡️" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '✅ Verifica tu cuenta de SentinelBot',
    html: baseTemplate(content),
  });
  console.log('✅ Email de verificación enviado a:', email);
};

// ── Send welcome email (after verification) ────────────────
const sendWelcomeEmail = async (email, username) => {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
  const botInviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot+applications.commands&permissions=8`;

  const content = `
    <p class="greeting">¡Tu cuenta está verificada! 🎉</p>
    <p class="text">¡Excelente, <strong style="color:#00d4ff">${username}</strong>! Tu cuenta ha sido verificada con éxito. Ahora puedes acceder a tu dashboard y comenzar a proteger tus servidores de Discord.</p>

    <div class="btn-wrap">
      <a href="${dashboardUrl}" class="btn">ABRIR DASHBOARD</a>
    </div>

    <hr class="divider">
    <p class="text" style="font-size: 14px; color: #7dd3fc;"><strong>Próximos pasos:</strong></p>
    <p class="text">1. 🤖 <a href="${botInviteUrl}" style="color:#00d4ff">Invita el bot</a> a tu servidor Discord.<br>
    2. ⚙️ Configura los canales de alertas y logs.<br>
    3. 🛡️ Activa la protección anti-nuke.<br>
    4. 📋 Configura la whitelist de usuarios de confianza.</p>

    <div class="feature-grid">
      <div class="feature"><span class="fi">🚫</span><span class="ft">Anti Mass-Ban</span></div>
      <div class="feature"><span class="fi">🔒</span><span class="ft">Anti Role Delete</span></div>
      <div class="feature"><span class="fi">⚠️</span><span class="ft">Alertas Instantáneas</span></div>
    </div>
  `;

  await transporter.sendMail({
    from: `"SentinelBot 🛡️" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🎉 ¡Bienvenido a SentinelBot! Tu cuenta está lista',
    html: baseTemplate(content),
  });
  console.log('✅ Email de bienvenida enviado a:', email);
};

// ── Send security alert email ──────────────────────────────
const sendSecurityAlert = async (email, serverName, eventType, details) => {
  const content = `
    <p class="greeting" style="color: #fca5a5;">🚨 Alerta de Seguridad</p>
    <p class="text">Se detectó actividad sospechosa en tu servidor <strong style="color:#00d4ff">${serverName}</strong>:</p>
    <div style="background:#1a0000; border: 1px solid rgba(239,68,68,.3); border-radius:10px; padding: 16px; margin: 16px 0;">
      <p style="color:#fca5a5; font-weight:600; margin-bottom:8px;">${eventType}</p>
      <p style="color:#94a3b8; font-size:14px;">${details}</p>
    </div>
    <div class="btn-wrap">
      <a href="${process.env.FRONTEND_URL || '#'}/dashboard" class="btn">VER EN DASHBOARD</a>
    </div>
  `;

  await transporter.sendMail({
    from: `"SentinelBot Alertas 🚨" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `🚨 ALERTA: Actividad sospechosa en ${serverName}`,
    html: baseTemplate(content),
  });
  console.log('✅ Email de alerta enviado a:', email);
};

module.exports = { sendVerificationEmail, sendWelcomeEmail, sendSecurityAlert };
