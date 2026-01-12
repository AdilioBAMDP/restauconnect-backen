/*
  Script: simulate-driver-socket.js
  Usage examples:
    # mode interactif (répondre aux propositions manuellement)
    DRIVER_ID=691e652e1a4f01112901a353 SERVER_URL=http://localhost:5000 node scripts/simulate-driver-socket.js

    # auto accept
    DRIVER_ID=691e652e1a4f01112901a353 SERVER_URL=http://localhost:5000 AUTO_ACCEPT=true node scripts/simulate-driver-socket.js

  Description: se connecte au serveur socket.io, rejoint la room driver-{DRIVER_ID} et écoute
               les événements 'delivery-proposal'. Peut accepter/rejeter automatiquement selon
               AUTO_ACCEPT/AUTO_REJECT_MS environment variables.
*/

const ioClient = require('socket.io-client');


// Parse CLI args (e.g. --DRIVER_ID=xxx)
const argv = require('minimist')(process.argv.slice(2));

// Priority: CLI arg > env var > default
const DRIVER_ID = argv.DRIVER_ID || argv.driver_id || process.env.DRIVER_ID || '';
const SERVER_URL = argv.SERVER_URL || argv.server_url || process.env.SERVER_URL || 'http://localhost:5000';
const AUTO_ACCEPT = (argv.AUTO_ACCEPT || argv.auto_accept || process.env.AUTO_ACCEPT) === 'true' || (argv.AUTO_ACCEPT || argv.auto_accept || process.env.AUTO_ACCEPT) === '1';
const AUTO_REJECT_MS = Number(argv.AUTO_REJECT_MS || argv.auto_reject_ms || process.env.AUTO_REJECT_MS || 0);

if (!DRIVER_ID) {
  console.error('ERROR: DRIVER_ID must be provided.\n'
    + 'Usage (PowerShell):\n'
    + '  $env:DRIVER_ID = "xxx"; node scripts/simulate-driver-socket.js\n'
    + 'Ou (bash):\n'
    + '  DRIVER_ID=xxx node scripts/simulate-driver-socket.js\n'
    + 'Ou avec arguments :\n'
    + '  node scripts/simulate-driver-socket.js --DRIVER_ID=xxx [--SERVER_URL=...] [--AUTO_ACCEPT=true] [--AUTO_REJECT_MS=7000]');
  process.exit(1);
}

console.log(`🔗 Connecting to ${SERVER_URL} as driver ${DRIVER_ID}...`);

const socket = ioClient(SERVER_URL, {
  transports: ['websocket', 'polling'],
  auth: {
    // optionally add token here if your server requires it
    // token: process.env.DRIVER_TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected socket id:', socket.id);
  // Join driver room and send driver-online event
  socket.emit('join-room', `driver-${DRIVER_ID}`);
  socket.emit('driver-online', DRIVER_ID);
});

socket.on('connect_error', (err) => {
  console.error('🔴 Connect error:', err.message || err);
});

socket.on('delivery-proposal', (data) => {
  console.log('\n📣 Delivery proposal received:');
  console.log(JSON.stringify(data, null, 2));

  const { proposalId, deliveryId } = data;

  // Auto accept
  if (AUTO_ACCEPT) {
    console.log(`✅ Auto-accepting proposal ${proposalId} for driver ${DRIVER_ID}`);
    socket.emit('accept-delivery-proposal', { proposalId, driverId: DRIVER_ID });
    return;
  }

  if (AUTO_REJECT_MS > 0) {
    console.log(`⏳ Will auto-reject in ${AUTO_REJECT_MS} ms`);
    setTimeout(() => {
      console.log(`❌ Auto-rejecting proposal ${proposalId}`);
      socket.emit('reject-delivery-proposal', { proposalId, driverId: DRIVER_ID, reason: 'too_far' });
    }, AUTO_REJECT_MS);
    return;
  }

  // Interactive mode
  console.log(`Interactif — que voulez-vous faire ? (a = accepter, r = refuser, autre = ignore)
  Tapez 'a' ou 'r' puis Entrée`);
  process.stdin.once('data', (input) => {
    const cmd = String(input).trim();
    if (cmd === 'a') {
      socket.emit('accept-delivery-proposal', { proposalId, driverId: DRIVER_ID });
      console.log('✅ Accepté');
    } else if (cmd === 'r') {
      socket.emit('reject-delivery-proposal', { proposalId, driverId: DRIVER_ID, reason: 'too_busy' });
      console.log('❌ Refusé');
    } else {
      console.log('ℹ️ Ignoré — aucune action envoyée');
    }
  });
});

// Listen to delivery-assigned / delivery-assigned notifications
socket.on('delivery-assigned', (payload) => {
  console.log('\n🚚 Notification delivery-assigned:');
  console.log(JSON.stringify(payload, null, 2));
});

socket.on('proposal-accepted', (payload) => {
  console.log('\n🎉 Proposal accepted confirmation:', payload);
});

socket.on('proposal-rejected', (payload) => {
  console.log('\n✖️ Proposal rejected confirmation:', payload);
});

socket.on('disconnect', () => {
  console.log('⚠️ Socket disconnected');
});
