/*****************************************************************
 * KodX Node-JS Client
 *****************************************************************/

// Alperen Kayhan
// https://github.com/AlperenKayhan

/* Simulating IoT Backend Systems Device Communication via Node.js and WebSockets */


 /* JS Based -- Introduction Task for Embedded Systems, 
 Simulating Database Device Communication via Node.js and WebSockets*/

 // Requirments: linux based raspberry pi OR device with Similar use.


import os        from 'os';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import fetch     from 'node-fetch';
import { io }    from 'socket.io-client';
import fs        from 'fs';
import path      from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { timeStamp } from 'console';

/*######################### Global IDs ############################*/
let serialNo, sessionId;
let corpsID, CorpsLocationID;
let ErrorSimulationSentinelVal = 0, ErrorAccurance = 0, FileStorageSentinel = 0;
const lambda = 5.0;
let isFirstLog = true;
var m_devices_id;

/*######################### Log file path #########################*/
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LOG_FILE   = path.join(__dirname, 'LogRecords.txt');
const SESSION_FILE = path.join(__dirname, 'sessionID.txt');

fs.writeFileSync(LOG_FILE, ''); //Reseting the file

/*######################### Console --> File patch ################*/

const _log  = console.log;
const _warn = console.warn;
const _err  = console.error;
function stamp() { return new Date().toISOString(); }

function appendJsonLog(type, args) {
  const entry = {
    timestamp: stamp(),
    level: type,
    message: args.map(String).join(' ')
  };

  const jsonLine = (isFirstLog ? '  ' : '  ,') + JSON.stringify(entry, null, 2) + '\n';
  fs.appendFileSync(LOG_FILE, jsonLine);
  isFirstLog = false;
}

console.log  = (...a) => { _log (...a); appendJsonLog('LOG',  a); };
console.warn = (...a) => { _warn(...a); appendJsonLog('WARN', a); };
console.error= (...a) => { _err(...a); appendJsonLog('ERR',  a); };


/*######################### Gett Network ##############################*/
function getNetworkInfo() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal)
        return { ip: net.address, mac: net.mac };
    }
  }
  return { ip: '0.0.0.0', mac: '00:00:00:00:00:00' };
}
/*######################### Poisson Random ###########################*/
function poissonRandom(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0, k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
/*######################### Load File ###########################*/
function loadSessionId() {
  console.log('Looking for session file at', SESSION_FILE);
  if (!fs.existsSync(SESSION_FILE)){
    console.error('✖ sessionID.txt not found!');
    process.exit(1);
  }
  const raw = fs.readFileSync(SESSION_FILE, 'utf8');
  console.log('Raw file contents:', JSON.stringify(raw));
  const id = raw.trim();
  if (!id) {
    console.error('✖ sessionID.txt was empty after trimming.');
    process.exit(1);
  }
  console.log('✔ Parsed session ID:', id);
  return id;
}

/*######################### URL builder ###########################*/
function buildUrl(serialNo) {
  const { ip: localIP, mac: macAddress } = getNetworkInfo();
  const u   = new URL('https://dev-kodx.mepsan.com.tr/dv/DvOp');
  const add = (k, v) => u.searchParams.set(k, v);
  const S_val = loadSessionId();

  add('pts', Date.now().toString());
  add('S[S]', S_val);
  add('S[ptof]', '180');
  add('S[country]', '225');
  add('S[lang]', 'tr');
  add('S[serial_no]',     serialNo);
  add('S[serial_no_hw]',  '724564889999');
  add('d_short_code',     'kodxmcu_avenda_lindo_01');
  add('d_firmware',       'kodxmcu_avenda_lindo_01');
  add('d_mac_id',         macAddress);
  add('d_local_ip',       localIP);
  add('d_oper',           'Prod');
  add('d_mdl_id',         '9100200');
  add('d_sites_id',       '9100200');

  return u.toString();
}

/*######################### HTTP open #############################*/
async function fetchSession(serialNo) {
  const url = buildUrl(serialNo);
  console.log('➡ KodX URL:\n', url);

  const res  = await fetch(url);
  const body = await res.text();
  console.log('\n⬅ Response:\n', body);

  let json;
  try { json = JSON.parse(body); }
  catch { throw new Error('Invalid JSON response'); }

  sessionId         = json?.data?.S;
  corpsID           = json?.data?.corps_id;
  CorpsLocationID   = json?.data?.corps_locations_id;
  m_devices_id  =  json?.data?.devices_id;

  if (!sessionId) throw new Error('Session ID not found');

  console.log('Session ID:', sessionId);
  console.log('Corpse ID :', corpsID);
  console.log('LocationID:', CorpsLocationID);
  console.log('devices_id:', m_devices_id);

  return sessionId;
}

/*######################### Upload Files #############################*/
async function uploadLogFile(sessionId, serialNo) {
  const url = "https://dev-kodx.mepsan.com.tr/dl/DvLogUp";
  console.log("⬆ Preparing temp copy for upload...");

  // dosya kopyas
  const tempPath = path.join(__dirname, 'LogRecords_temp.txt');
  fs.copyFileSync(LOG_FILE, tempPath); 

  const form = new FormData();
  form.set('file', await fileFromPath(tempPath));
  console.log(m_devices_id + "+++++++++++++++++++++++");

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Cookie': `S=${sessionId}`,
      'sys_objects_name': 'alperen_test',
      'p_devices_id': m_devices_id
    },
    body: form
  });

  const text = await res.text();

  // Kopyayı temizle
  fs.unlinkSync(tempPath);

  if (!res.ok) {
    console.error(`✖ Upload failed: ${res.status}`, text);
    return;
  }

  console.log(`✅ Upload successful: ${res.status}`);
  console.log(text);
}


/*######################### Socket client ###########################*/
function startClient(sessionId) {
  console.log('▶ Starting socket client with Session ID:', sessionId);

  const socket = io('https://dev-kodx.mepsan.com.tr/s', {
    path: '/s.io',
    transports: ['websocket'],
    transportOptions: {
      websocket: { extraHeaders: { Cookie: `S=${sessionId}` } }
    }
  });

  let heartbeatInterval;
  socket.on('connect', () => {
    console.log('🔗 Connected:', socket.id);
    socket.emit('r', { n: sessionId, r: 'dev' });
    console.log('→ Sent registration');

    heartbeatInterval = setInterval(() => {
      console.log('→ ping');
      socket.emit('ping');

      if (ErrorSimulationSentinelVal) {
        console.warn('WARNING: System UNSTABLE manual reboot advised');
        ErrorAccurance = poissonRandom(lambda);
        if (ErrorAccurance <= 2) {
          console.error('System failure → auto-reboot');
          clearInterval(heartbeatInterval);
          socket.close();
          startClient(sessionId);
          ErrorSimulationSentinelVal = 0;
        }
      }
    }, 5000);
  });
  

  socket.on('pong', data => console.log('← pong', data));

  socket.on('m', raw => {
    let payload;
    try { payload = JSON.parse(raw.t); }
    catch { console.error('Bad payload', raw); return; }

    switch (payload.f) {
      case 'send_msg_log':
        console.log('MESSAGE:', payload.msg);
        break;

      case 'reboot':
        console.warn('🔄 Reboot command received restarting client');
        clearInterval(heartbeatInterval);
        socket.close();
        startClient(sessionId);
        break;

      case 'Power_Off':
        console.warn('System power-off requested');
        clearInterval(heartbeatInterval);
        socket.close();
        process.exit(0);
        break;

      case 'get_d_parameters': {
        const { ip, mac } = getNetworkInfo();
        console.log('—> Parameters:');
        console.log('Serial No:', serialNo);
        console.log('Corpse ID:', corpsID);
        console.log('Location ID:', CorpsLocationID);
        console.log('MAC:', mac, 'IP:', ip);
        break;
      }

      case 'changed_parameters':
        console.warn('Error simulation activated');
        ErrorSimulationSentinelVal = 1;
        break;

      case 'get_d_items': 
        console.log('#Log Record initialized');
        fs.writeFileSync(LOG_FILE,'[\n]');
        FileStorageSentinel = 1;
        isFirstLog = true;
        console.log("#Log Record initialized");
        
      break;

      case 'send_logs':
        uploadLogFile(sessionId, serialNo).catch(err => {
        console.error('Upload error:', err.message);});

        console.log("SEASION UPLOADED!");
      break;

      
      

      default:
        console.log('Unhandled function:', payload.f);
    }
  });

  socket.on('disconnect',   () => console.log('X Disconnected'));
  socket.on('connect_error',e => console.error('Connect error:', e.message));
}

/*######################### Main ############################*/
(async () => {
  try {
    serialNo = '251306200097';
    const id = await fetchSession(serialNo);
    startClient(id);
    
    process.on('exit', () => {fs.appendFileSync(LOG_FILE, ']\n');});
    process.on('SIGINT', () => {
    fs.appendFileSync(LOG_FILE, ']\n');
    process.exit(0);
  });

    if(FileStorageSentinel)
      fs.writeFileSync(LOG_FILE, ''); //Reseting the file
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
