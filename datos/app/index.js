const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const SESSION_PATH = './ww-session';

let client = null;
let lastQr = null;
let isInitializing = false;

// --- UTILIDADES ---
const delay = ms => new Promise(res => setTimeout(res, ms));

const cleanLocks = () => {
    return new Promise((resolve) => {
        exec('pkill -9 chrome || pkill -9 chromium || true', () => {
            const files = [
                path.join(SESSION_PATH, 'SingletonLock'),
                path.join(SESSION_PATH, 'Default', 'SingletonLock'),
                path.join(SESSION_PATH, 'SingletonCookie')
            ];
            files.forEach(f => { if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {} });
            resolve();
        });
    });
};

async function startWhatsApp() {
    if (isInitializing || (client && client.info)) return;
    isInitializing = true;

    await cleanLocks();
    await delay(1000);

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
        puppeteer: {
            executablePath: '/usr/bin/chromium',
            handleSIGTERM: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                `--user-data-dir=/tmp/wp-session-${Date.now()}`,
                '--disable-process-singleton'
            ],
        }
    });

    client.on('qr', qr => { lastQr = qr; qrcode.generate(qr, { small: true }); });
    
    client.on('ready', () => {
        lastQr = null;
        isInitializing = false;
        console.log('✅ WhatsApp listo y conectado');
    });

    client.on('auth_failure', () => {
        console.error('❌ Error de autenticación');
        isInitializing = false;
        if (fs.existsSync(SESSION_PATH)) fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    });

    client.on('disconnected', async () => {
        console.log('❌ Cliente desconectado');
        isInitializing = false;
        client = null;
    });

    await client.initialize().catch(err => {
        console.error("❌ Error inicialización:", err.message);
        isInitializing = false;
        client = null;
    });
}

// AUTO-ARRANQUE
if (fs.existsSync(SESSION_PATH) && fs.readdirSync(SESSION_PATH).length > 0) {
    console.log('📦 Sesión detectada. Iniciando motor...');
    startWhatsApp();
}

// --- ENDPOINTS ---

app.get('/', async (req, res) => {
    const style = `style="font-family:sans-serif; text-align:center; padding-top:40px; background:#f4f7f6; color:#333;"`;
    const card = `style="display:inline-block; background:white; padding:30px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.1); min-width:320px;"`;

    if (client && client.info) {
        try {
            const contacts = await client.getContacts();
            const chats = await client.getChats();
            const fullNumber = client.info.wid.user;
            const maskedNumber = "*******" + fullNumber.slice(-3);

            res.send(`
                <body ${style}>
                    <div ${card}>
                        <h1 style="color:#25D366; margin-bottom:10px;">WhatsApp Activo ✅</h1>
                        <p style="font-size:1.2em; margin:5px 0;">Conectado: <b>${maskedNumber}</b></p>
                        <div style="display:flex; justify-content:space-around; margin:20px 0; border-top:1px solid #eee; padding-top:20px;">
                            <div><b style="font-size:1.5em;">${contacts.length}</b><br><small>Contactos</small></div>
                            <div><b style="font-size:1.5em;">${chats.length}</b><br><small>Chats</small></div>
                        </div>
                        <div style="margin-top:20px; font-size:0.9em;">
                            <a href="/status">Status JSON</a> | <a href="/chats">Chats</a> 
                        </div>
                        <br>
                        <button onclick="confirm('¿Cerrar sesión?') && (location.href='/logout')" style="background:#ff4b4b; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">Cerrar Sesión</button>
                    </div>
                </body>
            `);
        } catch (e) {
            res.send(`<body ${style}><div ${card}><h2>Cargando datos de sesión...</h2><script>setTimeout(()=>location.reload(), 2000)</script></div></body>`);
        }
    } else {
        const sessionExists = fs.existsSync(SESSION_PATH) && fs.readdirSync(SESSION_PATH).length > 0;
        res.send(`
            <body ${style}>
                <div ${card}>
                    <h1 style="color:#888;">Servicio Detenido ❌</h1>
                    <p>${sessionExists ? 'Sesión guardada lista para reconectar.' : 'No hay sesiones activas.'}</p>
                    <button onclick="location.href='/login'" style="padding:15px 30px; background:#25d366; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1em;">
                        ${sessionExists ? 'Reconectar Ahora' : 'Iniciar Nueva Sesión'}
                    </button>
                </div>
            </body>
        `);
    }
});

app.get('/login', (req, res) => {
    startWhatsApp();
    res.send(`
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; background:#f4f7f6;">
            <div style="display:inline-block; background:white; padding:30px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                <h2>Vincular WhatsApp</h2>
                <div id="qr">Generando código...</div>
                <p><small>Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo</small></p>
                <script>
                    setInterval(() => {
                        fetch('/qr-image').then(r => {
                            if(r.ok) document.getElementById('qr').innerHTML = '<img src="/qr-image?t='+Date.now()+'" width="280" style="border:10px solid #eee;">';
                        });
                    }, 2000);
                    setInterval(() => {
                        fetch('/status-check').then(r => r.json()).then(d => { if(d.connected) location.href="/" });
                    }, 4000);
                </script>
            </div>
        </body>
    `);
});

app.get('/status', async (req, res) => {
    const connected = !!(client && client.info);
    let data = { connected, initializing: isInitializing };
    if (connected) {
        const contacts = await client.getContacts();
        const chats = await client.getChats();
        data = { ...data, user: client.info.wid.user, contacts: contacts.length, chats: chats.length };
    }
    res.json(data);
});

// Los demás endpoints (/qr-image, /status-check, /chats, /contacts, /send, /logout) se mantienen igual que la versión anterior.

app.get('/qr-image', (req, res) => {
    if (lastQr) {
        QRCode.toDataURL(lastQr).then(url => {
            const img = Buffer.from(url.split(',')[1], 'base64');
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(img);
        }).catch(() => res.status(500).end());
    } else { res.status(404).end(); }
});

app.get('/status-check', (req, res) => {
    res.json({ connected: !!(client && client.info), initializing: isInitializing });
});

app.get('/chats', async (req, res) => {
    if (!client || !client.info) return res.status(403).json({ error: 'No conectado' });
    const chats = await client.getChats();
    res.json(chats.map(c => ({ id: c.id._serialized, name: c.name, unread: c.unreadCount })));
});

app.get('/contacts', async (req, res) => {
    if (!client || !client.info) return res.status(403).json({ error: 'No conectado' });
    const contacts = await client.getContacts();
    res.json(contacts.map(c => ({ id: c.id._serialized, name: c.name || c.pushname })));
});

app.get('/send', async (req, res) => {
    const { number, message } = req.query;
    if (!client || !client.info) return res.status(403).send('No conectado');
    try {
        const chatId = number.includes('@') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.send('✅ Enviado');
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/logout', async (req, res) => {
    if (client) try { await client.logout(); } catch(e){}
    if (client) try { await client.destroy(); } catch(e){}
    client = null;
    isInitializing = false;
    if (fs.existsSync(SESSION_PATH)) fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    res.send('Sesión destruida correctamente. <a href="/">Volver</a>');
});

app.listen(3000, () => console.log('🚀 API de WhatsApp lista en puerto 3000'));