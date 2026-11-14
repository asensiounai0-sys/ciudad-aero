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
      const db = await boot();
      if (name === 'db') return DBo || (DBo = makeDB(db));
      if (name === 'room') return ROOMo || (ROOMo = makeRoom(db));
      if (name === 'user') return USER;
      return null;
    }
  };
  window.CIUDAD_ONLINE = true;
})();
