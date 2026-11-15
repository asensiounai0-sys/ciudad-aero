/* =========================================================
   Ciudad Aero · modo online fuera de Claude
   Usa Firebase Realtime Database (gratis) para el chat, los
   amigos, las clasificaciones, las casas y el multijugador.
   Si config.js está vacío, el juego funciona en solitario.
   ========================================================= */
(function () {
  const CFG = window.FIREBASE_CONFIG;
  if (window.claude || !CFG || !CFG.databaseURL) return;

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const loadScript = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  let ready = null;
  function boot() {
    if (!ready) ready = (window.firebase && firebase.database ? Promise.resolve() :
      loadScript(SDK + 'firebase-app-compat.js').then(() => loadScript(SDK + 'firebase-database-compat.js')))
      .then(() => { if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CFG); return firebase.database(); });
    return ready;
  }

  // identidad del jugador en este dispositivo
  const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');
  let UID = localStorage.getItem('ciudadAeroUid');
  if (!UID) { UID = 'u_' + rnd(20); localStorage.setItem('ciudadAeroUid', UID); }

  /* ---------- cuentas: usuario + contraseña ---------- */
  const ACC = localStorage.getItem('ciudadAeroAcc');
  const GUEST = localStorage.getItem('ciudadAeroGuest') === '1';
  let authOk; const authed = new Promise(r => authOk = r);
  if (ACC || GUEST) authOk();
  window.CIUDAD_ACCOUNT = ACC || null;
  window.CIUDAD_LOGOUT = () => { ['ciudadAeroAcc', 'ciudadAeroGuest', 'ciudadAeroSave', 'ciudadAeroChar', 'ciudadAeroUid'].forEach(k => localStorage.removeItem(k)); location.reload(); };
  async function sha(txt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
  const accKey = n => n.trim().toLowerCase().replace(/[^a-z0-9_ñ]/g, '');
  function loginScreen() {
    const css = document.createElement('style');
    css.textContent = `#lgWrap{position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 20%,rgba(255,255,255,.35),rgba(10,90,140,.55));backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Nunito,system-ui,sans-serif}
#lgBox{width:min(380px,100%);padding:20px 20px 16px;border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(220,245,255,.88));border:2px solid #fff;box-shadow:0 12px 40px rgba(0,60,110,.35),inset 0 1px 0 #fff;text-align:center;color:#0b3d62}
#lgBox img{width:min(300px,90%);border-radius:18px;margin:0 auto 8px;display:block}
#lgBox h2{margin:4px 0 12px;font-size:20px;font-weight:900}
.lgTabs{display:flex;gap:6px;margin-bottom:12px}.lgTabs button{flex:1;padding:9px;border-radius:14px;border:2px solid #fff;font:900 14px Nunito,sans-serif;color:#0b3d62;background:rgba(255,255,255,.6);cursor:pointer}.lgTabs button.on{background:linear-gradient(180deg,#bff0ff,#3cb6e6);color:#fff;text-shadow:0 1px 2px rgba(0,60,110,.5)}
#lgBox input{width:100%;box-sizing:border-box;margin:5px 0;padding:12px 14px;border-radius:14px;border:2px solid #bfe6f8;font:800 15px Nunito,sans-serif;color:#0b3d62;background:#fff;outline:none}#lgBox input:focus{border-color:#3cb6e6}
.lgGo{width:100%;margin-top:8px;padding:12px;border:2px solid #fff;border-radius:16px;font:900 16px Nunito,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(180deg,#b6f5a0,#2a9d3a 55%,#3ab84a);text-shadow:0 1px 2px rgba(0,60,0,.5);box-shadow:0 4px 12px rgba(0,90,40,.3)}
.lgGuest{margin-top:10px;background:none;border:none;color:#0a6fb0;font:800 13px Nunito,sans-serif;text-decoration:underline;cursor:pointer}
#lgMsg{min-height:18px;font-weight:800;font-size:13px;color:#d63a6a;margin-top:6px}`;
    document.head.appendChild(css);
    const w = document.createElement('div'); w.id = 'lgWrap';
    w.innerHTML = `<div id="lgBox"><img src="logo.png" alt="Ciudad Aero"><div class="lgTabs"><button data-m="in" class="on">Iniciar sesión</button><button data-m="new">Crear cuenta</button></div>
<input id="lgUser" maxlength="16" placeholder="Usuario" autocomplete="username" autocapitalize="off"><input id="lgPass" type="password" maxlength="40" placeholder="Contraseña" autocomplete="current-password">
<input id="lgPass2" type="password" maxlength="40" placeholder="Repite la contraseña" autocomplete="new-password" hidden>
<button class="lgGo" id="lgGo">Entrar</button><div id="lgMsg"></div><button class="lgGuest" id="lgGuest">Jugar sin cuenta (solo en este dispositivo)</button></div>`;
    document.body.appendChild(w);
    let modo = 'in'; const $l = id => document.getElementById(id), msg = t => { $l('lgMsg').textContent = t; };
    w.querySelectorAll('.lgTabs button').forEach(b => b.onclick = () => { modo = b.dataset.m; w.querySelectorAll('.lgTabs button').forEach(x => x.classList.toggle('on', x === b)); $l('lgPass2').hidden = modo !== 'new'; $l('lgGo').textContent = modo === 'new' ? 'Crear cuenta' : 'Entrar'; msg(''); });
    ['lgUser', 'lgPass', 'lgPass2'].forEach(id => $l(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $l('lgGo').click(); }));
    ['keyup', 'keypress'].forEach(ev => w.addEventListener(ev, e => e.stopPropagation()));
    $l('lgGuest').onclick = () => { localStorage.setItem('ciudadAeroGuest', '1'); w.remove(); authOk(); };
    let busy = false;
    $l('lgGo').onclick = async () => {
      if (busy) return; const name = $l('lgUser').value.trim(), key = accKey(name), pass = $l('lgPass').value;
      if (key.length < 3) return msg('El usuario necesita al menos 3 letras o números');
      if (pass.length < 4) return msg('La contraseña necesita al menos 4 caracteres');
      if (modo === 'new' && pass !== $l('lgPass2').value) return msg('Las contraseñas no coinciden');
      busy = true; msg('Conectando…');
      try {
        const db = await boot(); const ref = db.ref('acc').child(key);
        if (modo === 'new') {
          const salt = rnd(16), h = await sha(salt + ':' + pass);
          const r = await ref.transaction(cur => cur ? undefined : { n: name.slice(0, 16), s: salt, h, u: UID, t: Date.now() });
          if (!r || !r.committed) { busy = false; return msg('Ese usuario ya existe, elige otro'); }
          localStorage.setItem('ciudadAeroAcc', name.slice(0, 16)); localStorage.removeItem('ciudadAeroGuest');
          window.CIUDAD_ACCOUNT = name.slice(0, 16); w.remove(); authOk();
        } else {
          const a = (await ref.once('value')).val();
          if (!a) { busy = false; return msg('Ese usuario no existe'); }
          if (await sha(a.s + ':' + pass) !== a.h) { busy = false; return msg('Contraseña incorrecta'); }
          localStorage.setItem('ciudadAeroAcc', a.n || name); localStorage.removeItem('ciudadAeroGuest');
          if (a.u !== UID) { // otra cuenta: cargamos su partida desde el servidor
            localStorage.setItem('ciudadAeroUid', a.u); localStorage.removeItem('ciudadAeroSave'); localStorage.removeItem('ciudadAeroChar');
            msg('¡Hola de nuevo! Cargando tu partida…'); setTimeout(() => location.reload(), 300); return;
          }
          window.CIUDAD_ACCOUNT = a.n || name; w.remove(); authOk();
        }
      } catch (e) { busy = false; msg('No se pudo conectar. Revisa internet o la configuración de Firebase.'); }
    };
    setTimeout(() => $l('lgUser').focus(), 100);
  }
  if (!ACC && !GUEST) { if (document.body) loginScreen(); else addEventListener('DOMContentLoaded', loginScreen); }

  const clean = s => String(s).replace(/[.#$\[\]]/g, '_');
  // "a/b" -> colección "a", doc "b" · "a/b/c/d" -> colección "a|b|c", doc "d"
  const split = path => { const p = path.split('/').filter(Boolean); return { col: p.slice(0, -1).map(clean).join('|'), id: clean(p[p.length - 1]) }; };
  const colKey = path => path.split('/').filter(Boolean).map(clean).join('|');
  const pack = v => ({ j: JSON.stringify(v), t: v && typeof v.t === 'number' ? v.t : Date.now() });
  const unpack = v => { try { return v && typeof v.j === 'string' ? JSON.parse(v.j) : undefined; } catch (e) { return undefined; } };
  const docSnap = (id, data, ref) => ({ id, exists: data !== undefined, data: () => data, ref, metadata: { fromCache: false, hasPendingWrites: false } });

  function makeDB(db) {
    const root = db.ref('ca');
    function docRef(path) {
      const { col, id } = split(path); const ref = root.child(col).child(id);
      const api = {
        id, path,
        get: async () => docSnap(id, unpack((await ref.once('value')).val()), api),
        set: async v => { await ref.set(pack(JSON.parse(JSON.stringify(v)))); },
        update: async v => {
          const cur = unpack((await ref.once('value')).val());
          if (cur === undefined) { const e = new Error('No existe'); e.code = 'not_found'; throw e; }
          await ref.set(pack(Object.assign(cur, JSON.parse(JSON.stringify(v)))));
        },
        delete: async () => { await ref.remove(); },
        acquire: async (o) => {
          o = o || {}; const holder = o.holder || UID, ttl = o.ttlMs || 5000;
          const r = await db.ref('locks').child(col + '|' + id).transaction(cur => {
            if (cur && cur.h !== holder && cur.x > Date.now()) return; // ocupado
            return { h: holder, x: Date.now() + ttl };
          });
          return { acquired: !!(r && r.committed) };
        },
        onSnapshot: (next, err) => {
          const h = s => next(docSnap(id, unpack(s.val()), api));
          ref.on('value', h, e => err && err(e));
          return () => ref.off('value', h);
        },
        collection: p => colRef(path + '/' + p)
      };
      return api;
    }
    function colRef(path, q) {
      q = q || { w: [], o: null, l: 1000 };
      const base = root.child(colKey(path));
      const query = () => (q.o && q.o[0] === 't') ? base.orderByChild('t').limitToLast(q.l) : base;
      const build = s => {
        let docs = []; const v = s.val() || {};
        for (const id in v) { const d = unpack(v[id]); if (d !== undefined) docs.push(docSnap(id, d, docRef(path + '/' + id))); }
        for (const [f, op, val] of q.w) docs = docs.filter(d => { const x = d.data()[f]; return op === 'array-contains' ? Array.isArray(x) && x.includes(val) : op === '!=' ? x !== val : x === val; });
        if (q.o) { const [f, dir] = q.o; docs.sort((a, b) => ((+a.data()[f] || 0) - (+b.data()[f] || 0)) * (dir === 'desc' ? -1 : 1)); }
        docs = docs.slice(0, q.l);
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false }, forEach: f => docs.forEach(f) };
      };
      return {
        path,
        where: (f, op, v) => colRef(path, Object.assign({}, q, { w: [...q.w, [f, op, v]] })),
        orderBy: (f, dir) => colRef(path, Object.assign({}, q, { o: [f, dir || 'asc'] })),
        limit: n => colRef(path, Object.assign({}, q, { l: n })),
        get: async () => build(await query().once('value')),
        onSnapshot: (next, err) => { const qq = query(); const h = s => next(build(s)); qq.on('value', h, e => err && err(e)); return () => qq.off('value', h); },
        doc: id => docRef(path + '/' + (id || base.push().key)),
        add: async v => { const r = docRef(path + '/' + base.push().key); await r.set(v); return r; }
      };
    }
    return { doc: docRef, collection: colRef };
  }

  function makeRoom(db) {
    const node = db.ref('room'); const PEER = 'p_' + rnd(10); const me = node.child(PEER);
    let mine = {}, lastSent = '', lastAt = 0, timer = null, armed = false;
    const peers = {}; const subs = new Set();
    const toPeer = (id, v) => Object.freeze({ peer: id, by: v.by || null, isMe: id === PEER, sameTab: id === PEER, kind: 'viewer', guest: false, presence: unpack(v) || {}, updatedAt: v.t || Date.now() });
    const emit = (j, u, l) => { const list = Object.values(peers); subs.forEach(f => { try { f({ peers: list, joined: j, updated: u, left: l }); } catch (e) { } }); };
    function send() {
      timer = null; const js = JSON.stringify(mine); if (js === lastSent) return;
      lastSent = js; lastAt = Date.now();
      if (!armed) { armed = true; me.onDisconnect().remove(); }
      me.set({ by: UID, j: js, t: firebase.database.ServerValue.TIMESTAMP }).catch(() => { });
    }
    node.on('child_added', s => { const v = s.val() || {}; if (v.t && Date.now() - v.t > 15 * 60e3 && s.key !== PEER) return; const p = peers[s.key] = toPeer(s.key, v); emit([p], [], []); });
    node.on('child_changed', s => { const p = peers[s.key] = toPeer(s.key, s.val() || {}); emit([], [p], []); });
    node.on('child_removed', s => { const p = peers[s.key]; if (!p) return; delete peers[s.key]; emit([], [], [p]); });
    // si se pierde la conexión y vuelve, nos volvemos a anunciar
    db.ref('.info/connected').on('value', s => { if (s.val() === true && armed) { armed = false; lastSent = ''; send(); } });
    return {
      presence: async patch => {
        mine = Object.assign({}, mine, patch); for (const k in mine) if (mine[k] === null || mine[k] === undefined) delete mine[k];
        if (timer) return; const wait = Math.max(0, 150 - (Date.now() - lastAt)); timer = setTimeout(send, wait);
      },
      onPeers: (f) => { subs.add(f); setTimeout(() => f({ peers: Object.values(peers), joined: Object.values(peers), updated: [], left: [] }), 0); return () => subs.delete(f); },
      peers: () => Object.values(peers), connected: () => true, emit: async () => { }, on: () => () => { }
    };
  }

  let DBo = null, ROOMo = null;
  const USER = { id: async () => UID, can: async () => true, isOwner: () => false };
  window.claude = {
    use: async name => {
      await authed; const db = await boot();
      if (name === 'db') return DBo || (DBo = makeDB(db));
      if (name === 'room') return ROOMo || (ROOMo = makeRoom(db));
      if (name === 'user') return USER;
      return null;
    }
  };
  window.CIUDAD_ONLINE = true;
})();
