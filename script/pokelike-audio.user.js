// ==UserScript==
// @name         PokeLike Toolkit v6.0
// @namespace    http://tampermonkey.net/
// @version      6.0.1
// @description  Audio engine + DexFaker + StarterPC + BuffFaker per pokelike.xyz
// @author       Erry96
// @match        https://pokelike.xyz/*
// @match        https://www.pokelike.xyz/*
// @updateURL    https://deven-debug.github.io/pokelike-audio/script/pokelike-audio.user.js
// @downloadURL  https://deven-debug.github.io/pokelike-audio/script/pokelike-audio.user.js
// @connect      pokeapi.co
// @grant        none
// @run-at       document-end
// ==/UserScript==

/*
  ============================================================
  DOVE CARICARE GLI MP3 (se vuoi usare file reali invece di sintesi):
  ============================================================
  Opzione A - GitHub Pages (GRATUITO, CONSIGLIATO):
    1. Crea repo GitHub > Settings > Pages > abilitalo su /root o /docs
    2. Carica gli MP3 nella cartella /audio/
    3. Nei const MP3_BGM e MP3_SFX sotto, usa:
       'https://TUO_UTENTE.github.io/TUA_REPO/audio/nome.mp3'

  Opzione B - Qualsiasi CDN/hosting statico (Netlify, Cloudflare Pages, ecc.)
    Carica i file e usa i link diretti.

  Opzione C - Base64 (file piccoli, < ~500KB):
    Converti il file con un tool online in base64 e usa:
    'data:audio/mp3;base64,XXXXXXXX'

  Opzione D - Lascia vuote le URL (default): usa la sintesi Web Audio API.
  ============================================================
*/

(function () {
  'use strict';

  // ============================================================
  // CONFIGURAZIONE URL MP3 (lascia '' per usare la sintesi)
  // ============================================================
  const CDN = 'https://deven-debug.github.io/pokelike-audio';

  const MP3_BGM = {
    map:    `${CDN}/audio/bgm/map.mp3`,
    map1:    `${CDN}/audio/bgm/map1.mp3`,
    map2:    `${CDN}/audio/bgm/map2.mp3`,
    map3:    `${CDN}/audio/bgm/map3.mp3`,
    map4:    `${CDN}/audio/bgm/map4.mp3`,
    map5:    `${CDN}/audio/bgm/map5.mp3`,
    map6:    `${CDN}/audio/bgm/map6.mp3`,
    map7:    `${CDN}/audio/bgm/map7.mp3`,
    map8:    `${CDN}/audio/bgm/map8.mp3`,
    map9:    `${CDN}/audio/bgm/map9.mp3`,
    map10:    `${CDN}/audio/bgm/map10.mp3`,
    map11:    `${CDN}/audio/bgm/map11.mp3`,
    // gli altri pattern BGM usano solo la sintesi — nessun MP3 aggiuntivo
  };

  const MP3_SFX = {
    wild:      `${CDN}/audio/sfx/wild.mp3`,
    trainer:   `${CDN}/audio/sfx/trainer.mp3`,
    gym:       `${CDN}/audio/sfx/gym.mp3`,
    catch:     `${CDN}/audio/sfx/catch.mp3`,
    item:      `${CDN}/audio/sfx/item.mp3`,
    heal:      `${CDN}/audio/sfx/heal.mp3`,
    trade:     `${CDN}/audio/sfx/trade.mp3`,
    shiny:     `${CDN}/audio/sfx/shiny.mp3`,
    legendary: `${CDN}/audio/sfx/legendary.mp3`,
    badge:     `${CDN}/audio/sfx/badge.mp3`,
    levelup:   `${CDN}/audio/sfx/levelup.mp3`,
    faint:     `${CDN}/audio/sfx/faint.mp3`,
    gameover:  `${CDN}/audio/sfx/gameover.mp3`,
    victory:   `${CDN}/audio/sfx/victory.mp3`,
    select:    `${CDN}/audio/sfx/select.mp3`,
    click:     `${CDN}/audio/sfx/click.mp3`,
  };

  // ============================================================
  // AUDIO CONTEXT E UTILS
  // ============================================================
  let audioCtx = null;

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  const SETTINGS = {
    sfxVolume: 0.08,
    sfxEnabled: true,
    gameBgmVolume: 0.5,
    gameBgmEnabled: true,
    bgmEnabled: false,
    bgmVolume: 0.06,
    bgmTrack: 'map',
  };

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('poke_audio_settings') || '{}');
      Object.assign(SETTINGS, s);
    } catch {}
  }

  function saveSettings() {
    try { localStorage.setItem('poke_audio_settings', JSON.stringify(SETTINGS)); } catch {}
  }

  loadSettings();

  // TOOLS - DexFaker, StarterPC, BuffFaker
  const TOOLS_STORAGE_KEY = 'poke_tools_settings';
  const GENS = {
    'Gen 1  (1-151)': [1, 151], 'Gen 2  (152-251)': [152, 251],
    'Gen 3  (252-386)': [252, 386], 'Gen 4  (387-493)': [387, 493],
    'Gen 5  (494-649)': [494, 649], 'Gen 6  (650-721)': [650, 721],
    'Gen 7  (722-809)': [722, 809], 'Gen 8  (810-905)': [810, 905],
    'Gen 9  (906-1025)': [906, 1025],
  };
  const TOOLS = { dfShiny: false, spcEnabled: false, spcShiny: false, spcIndividuals: [] };
  function loadTools() { try { Object.assign(TOOLS, JSON.parse(localStorage.getItem(TOOLS_STORAGE_KEY) || '{}')); } catch {} }
  function saveTools() { try { localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(TOOLS)); } catch {} }
  loadTools();
  let _dfRunning = false;
  async function _fetchPoke(id) {
    const r = await fetch('https://pokeapi.co/api/v2/pokemon/' + id);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const name = d.name.charAt(0).toUpperCase() + d.name.slice(1);
    const types = d.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1));
    const normalSprite = d.sprites.front_default || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + d.id + '.png';
    const shinySprite = d.sprites.front_shiny || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/' + d.id + '.png';
    return { id: d.id, name, types, normalSprite, shinySprite };
  }
  async function _dfSimulate(id, addShiny) {
    const data = await _fetchPoke(id);
    if (typeof window.markPokedexCaught === 'function') {
      window.markPokedexCaught(data.id, data.name, data.types, data.normalSprite);
    } else {
      const dex = JSON.parse(localStorage.getItem('poke_dex') || '{}');
      dex[data.id] = { id: data.id, caught: true, name: data.name, types: data.types, spriteUrl: data.normalSprite };
      localStorage.setItem('poke_dex', JSON.stringify(dex));
    }
    if (addShiny) {
      if (typeof window.markShinyDexCaught === 'function') {
        window.markShinyDexCaught(data.id, data.name, data.types, data.shinySprite);
      } else {
        const sdex = JSON.parse(localStorage.getItem('poke_shiny_dex') || '{}');
        sdex[data.id] = { id: data.id, name: data.name, types: data.types, shinySpriteUrl: data.shinySprite };
        localStorage.setItem('poke_shiny_dex', JSON.stringify(sdex));
      }
    }
    return data.name;
  }
  async function _dfSimulateGen(genKey, addShiny, statusEl, progEl) {
    if (_dfRunning) return;
    _dfRunning = true;
    const [first, last] = GENS[genKey];
    const total = last - first + 1;
    let done = 0, errors = 0;
    for (let id = first; id <= last; id++) {
      if (!_dfRunning) break;
      try { await _dfSimulate(id, addShiny); } catch { errors++; }
      done++;
      progEl.textContent = done + ' / ' + total;
      statusEl.textContent = 'ID ' + id + '...';
      await new Promise(r => setTimeout(r, 150));
    }
    _dfRunning = false;
    if (typeof window.checkDexAchievements === 'function') window.checkDexAchievements();
    statusEl.textContent = 'Completato: ' + (done - errors) + '/' + total + (errors ? ' (' + errors + ' err)' : '');
    progEl.textContent = '';
  }
  function spcBuildIds() {
    const ids = TOOLS.spcIndividuals || [];
    return ids.length ? [ids[0]] : [];
  }
  function spcSetIndividual(id) {
    const n = parseInt(id, 10);
    if (!n || n < 1 || n > 1025) return { ok: false, msg: 'ID non valido (1-1025)' };
    TOOLS.spcIndividuals = [n];
    saveTools();
    return { ok: true, id: n };
  }
  function spcClearIndividual() {
    TOOLS.spcIndividuals = [];
    saveTools();
  }
  async function spcAddByName(name) {
    const q = (name || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!q) return { ok: false, msg: 'Inserisci un nome' };
    try {
      const data = await _fetchPoke(q);
      const added = spcSetIndividual(data.id);
      if (!added.ok) return { ...added, name: data.name };
      return { ok: true, id: data.id, name: data.name };
    } catch {
      return { ok: false, msg: '"' + name + '" non trovato' };
    }
  }
  async function _resolvePokeId(raw) {
    const q = (raw || '').trim();
    if (!q) return { ok: false, msg: 'Inserisci N. Pokedex o nome' };
    if (/^\d+$/.test(q)) {
      const n = parseInt(q, 10);
      if (n >= 1 && n <= 1025) return { ok: true, id: n };
      return { ok: false, msg: 'ID non valido (1-1025)' };
    }
    try {
      const data = await _fetchPoke(q.toLowerCase().replace(/\s+/g, '-'));
      return { ok: true, id: data.id, name: data.name };
    } catch {
      return { ok: false, msg: '"' + q + '" non trovato' };
    }
  }
  function _spcFakeEntry() {
    const ids = spcBuildIds();
    if (ids.length === 0) return null;
    return {
      _starterpc_fake: true, savedAt: 0, runNumber: 0, hardMode: false,
      endless: true, stageNumber: 1, starterSpeciesId: null, date: '',
      team: ids.map(id => ({ speciesId: id, isShiny: TOOLS.spcShiny, level: 5, name: '', types: [], spriteUrl: '' })),
    };
  }
  const BF_STATS = ['hp', 'atk', 'def', 'speed', 'special'];
  function _bfGetStore() { try { return JSON.parse(localStorage.getItem('poke_stat_buffs') || '{}'); } catch { return {}; } }
  function _bfSaveStore(store) { try { localStorage.setItem('poke_stat_buffs', JSON.stringify(store)); } catch {} }
  function _bfGetRoot(id) { return typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(id) : id; }
  function _bfReadSliders() {
    const vals = {};
    BF_STATS.forEach(s => {
      const el = document.getElementById('bf-stat-' + s);
      vals[s] = parseInt((el && el.value) || '0', 10);
    });
    return vals;
  }
  function _bfShowCurrentBuffs(speciesId) {
    const buffs = (_bfGetStore())[_bfGetRoot(speciesId)] || {};
    BF_STATS.forEach(s => {
      const el = document.getElementById('bf-stat-' + s);
      const vl = document.getElementById('bf-val-' + s);
      const v = buffs[s] ?? 0;
      if (el) el.value = v;
      if (vl) vl.textContent = v;
    });
  }
  async function _bfApply(speciesId, vals) {
    const store = _bfGetStore();
    store[_bfGetRoot(speciesId)] = { ...vals };
    _bfSaveStore(store);
  }
  function _refreshSoon(ms) {
    if (ms === undefined) ms = 2500;
    setTimeout(() => location.reload(), ms);
  }
  function applySpcPatches() {
    if (typeof window.getHallOfFame !== 'function') return false;
    const _origGetHof = window.getHallOfFame;
    const _origOpenHof = window.openHallOfFameModal;
    function patchedGetHof() {
      const real = _origGetHof();
      if (!TOOLS.spcEnabled) return real;
      const fake = _spcFakeEntry();
      return fake ? [...real, fake] : real;
    }
    window.getHallOfFame = patchedGetHof;
    window.openHallOfFameModal = function () {
      window.getHallOfFame = _origGetHof;
      if (typeof _origOpenHof === 'function') _origOpenHof();
      window.getHallOfFame = patchedGetHof;
    };
    return true;
  }
  function bypassMaintenance() { document.documentElement.classList.remove('poke-maint-on'); }
  function watchMaintenanceBypass() {
    bypassMaintenance();
    new MutationObserver(() => {
      if (document.documentElement.classList.contains('poke-maint-on')) bypassMaintenance();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  bypassMaintenance();
  const DESKTOP_MQ = '(min-width: 769px)';
  function isDesktop() { return matchMedia(DESKTOP_MQ).matches; }
  function injectInstantScreenCSS() {
    if (document.getElementById('poke-audio-instant-screens')) return;
    const style = document.createElement('style');
    style.id = 'poke-audio-instant-screens';
    style.textContent = '@media ' + DESKTOP_MQ + ' { #transition-screen, #transition-screen.active { display: none !important; } body.run-menu-active, .screen, .run-menu-toggle.visible, #run-menu-bar.visible, .title-legal-footer { transition: none !important; } }';
    document.head.appendChild(style);
  }
  function patchGameTransitions() {
    const tryPatch = () => {
      if (typeof window.showEliteTransition === 'function' && !window.showEliteTransition.__pokePatched) {
        const orig = window.showEliteTransition;
        window.showEliteTransition = function (...args) { if (isDesktop()) return Promise.resolve(); return orig.apply(this, args); };
        window.showEliteTransition.__pokePatched = true;
      }
      if (typeof window.showScreen === 'function' && !window.showScreen.__pokePatched) {
        const origShow = window.showScreen;
        window.showScreen = function (id) { if (isDesktop() && id === 'transition-screen') return; return origShow.apply(this, arguments); };
        window.showScreen.__pokePatched = true;
      }
      if (!window.showScreen || !window.showScreen.__pokePatched || !window.showEliteTransition || !window.showEliteTransition.__pokePatched) setTimeout(tryPatch, 300);
    };
    if (!window.__pokeSetTimeoutPatched) {
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (fn, delay, ...args) {
        const tr = document.getElementById('transition-screen');
        if (isDesktop() && delay === 2000 && tr && tr.classList.contains('active')) delay = 0;
        return origSetTimeout.call(this, fn, delay, ...args);
      };
      window.__pokeSetTimeoutPatched = true;
    }
    tryPatch();
  }
  function applyGameBgmVolume() {
    const el = document.getElementById('bg-music');
    if (!el) return;
    el.volume = SETTINGS.gameBgmVolume;
    el.muted = !SETTINGS.gameBgmEnabled;
  }
  function watchGameBgm() {
    let bound = null;
    const bind = () => {
      const el = document.getElementById('bg-music');
      if (!el || el === bound) return;
      bound = el;
      ['play', 'volumechange', 'loadeddata', 'loadedmetadata'].forEach(ev => el.addEventListener(ev, applyGameBgmVolume));
      applyGameBgmVolume();
    };
    bind();
    new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  // ============================================================
  // SINTESI SFX
  // ============================================================
  function playTone(freq, type, duration, volume = 0.1, delay = 0) {
    if (!SETTINGS.sfxEnabled) return;
    const ctx = getCtx();
    const vol = volume * SETTINGS.sfxVolume / 0.18 * SYNTH_SCALE;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  // Cache buffer SFX: url → AudioBuffer | false(fallito) | null(loading)
  const _sfxBuffers = {};
  let _sfxPreloaded = false;

  function playMp3Sfx(url) {
    if (!SETTINGS.sfxEnabled || !url) return false;
    const buf = _sfxBuffers[url];
    if (buf === undefined) {
      _preloadSfx(url); // avvia preload in background
      return false;     // usa sintesi subito
    }
    if (!buf) return false; // in caricamento o fallito → usa sintesi
    const ctx = getCtx();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(SETTINGS.sfxVolume / 0.18, ctx.currentTime);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return true;
  }

  async function _preloadSfx(url) {
    if (_sfxBuffers[url] !== undefined) return;
    _sfxBuffers[url] = null; // in caricamento
    try {
      const r = await fetch(url);
      if (!r.ok) { _sfxBuffers[url] = false; return; }
      const buf = await r.arrayBuffer();
      _sfxBuffers[url] = await getCtx().decodeAudioData(buf);
    } catch { _sfxBuffers[url] = false; }
  }

  function preloadAllSfx() {
    Object.values(MP3_SFX).forEach(url => { if (url) _preloadSfx(url); });
  }

  // Cooldown per evitare SFX duplicati da observer multipli
  const _sfxCooldown = {};
  const SYNTH_SCALE = 0.35; // synth più bassi rispetto agli MP3
  function _sfxOnce(key, fn, ms = 400) {
    const now = Date.now();
    if (_sfxCooldown[key] && now - _sfxCooldown[key] < ms) return;
    _sfxCooldown[key] = now;
    fn();
  }

  // Helper: suona SFX e logga nome + modalità
  function _sfx(name, url, synthFn) {
    if (!SETTINGS.sfxEnabled) return;
    const mp3 = playMp3Sfx(url);
    console.log(
      `%c[SFX] ${name} → ${mp3 ? '\uD83C\uDFB5 MP3' : '\uD83D\uDD0A SYNTH'}`,
      `background:#0a1a2e;color:${mp3 ? '#00e5ff' : '#a0ffa0'};font-weight:bold;padding:1px 5px;border-left:2px solid ${mp3 ? '#00e5ff' : '#a0ffa0'};`
    );
    if (!mp3) synthFn();
  }

  // Ogni SFX con fallback sintesi
  const SFX = {
    WILD:      () => _sfx('WILD',      MP3_SFX.wild,      () => {
      playTone(330, 'sine', 0.12);
      playTone(262, 'sine', 0.25, 0.1, 0.12);
      playTone(440, 'sawtooth', 0.3, 0.12, 0.3);
    }),
    TRAINER:   () => _sfx('TRAINER',   MP3_SFX.trainer,   () => {
      [523, 659, 523, 784].forEach((f, i) => playTone(f, 'square', 0.1, 0.12, i * 0.11));
    }),
    GYM:       () => _sfx('GYM',       MP3_SFX.gym,       () => {
      [330, 415, 494, 659, 784].forEach((f, i) => playTone(f, 'sawtooth', 0.15, 0.14, i * 0.1));
    }),
    CATCH:     () => _sfx('CATCH',     MP3_SFX.catch,     () => {
      playTone(880, 'sine', 0.08);
      playTone(987, 'sine', 0.08, 0.1, 0.1);
      playTone(1046, 'sine', 0.12, 0.1, 0.2);
    }),
    ITEM:      () => _sfx('ITEM',      MP3_SFX.item,      () => {
      [1046, 1318, 1568].forEach((f, i) => playTone(f, 'sine', 0.15, 0.12, i * 0.08));
    }),
    HEAL:      () => _sfx('HEAL',      MP3_SFX.heal,      () => {
      [523, 659, 784, 1046].forEach((f, i) => playTone(f, 'triangle', 0.35, 0.12, i * 0.1));
    }),
    TRADE:     () => _sfx('TRADE',     MP3_SFX.trade,     () => {
      playTone(440, 'sine', 0.2);
      playTone(550, 'sine', 0.2, 0.1, 0.2);
      playTone(660, 'sine', 0.3, 0.12, 0.4);
    }),
    SHINY:     () => _sfx('SHINY',     MP3_SFX.shiny,     () => {
      [1568, 1760, 2093, 2637].forEach((f, i) => {
        playTone(f, 'sine', 0.1, 0.13, i * 0.07);
        playTone(f * 0.5, 'triangle', 0.2, 0.08, i * 0.07 + 0.05);
      });
    }),
    LEGENDARY: () => _sfx('LEGENDARY', MP3_SFX.legendary, () => {
      [196, 247, 330, 392, 494].forEach((f, i) => playTone(f, 'sawtooth', 0.4, 0.13, i * 0.12));
    }),
    BADGE:     () => _sfx('BADGE',     MP3_SFX.badge,     () => {
      [523, 659, 784, 1046, 1318].forEach((f, i) => playTone(f, 'triangle', 0.3, 0.13, i * 0.1));
    }),
    LEVELUP:   () => _sfx('LEVELUP',   MP3_SFX.levelup,   () => {
      [330, 415, 523].forEach((f, i) => playTone(f, 'sine', 0.15, 0.1, i * 0.1));
    }),
    FAINT:     () => _sfx('FAINT',     MP3_SFX.faint,     () => {
      [330, 262, 196, 147].forEach((f, i) => playTone(f, 'sawtooth', 0.25, 0.1, i * 0.12));
    }),
    GAMEOVER:  () => _sfx('GAMEOVER',  MP3_SFX.gameover,  () => {
      [262, 247, 220, 196, 175, 165].forEach((f, i) => playTone(f, 'triangle', 0.4, 0.13, i * 0.15));
    }),
    VICTORY:   () => _sfx('VICTORY',   MP3_SFX.victory,   () => {
      [523, 523, 523, 523, 415, 466, 523].forEach((f, i) => playTone(f, 'square', 0.12, 0.13, i * 0.15));
    }),
    SELECT:    () => _sfx('SELECT',    MP3_SFX.select,    () => {
      playTone(880, 'sine', 0.1);
      playTone(1100, 'sine', 0.15, 0.12, 0.1);
    }),
    CLICK:     () => _sfx('CLICK',     MP3_SFX.click,     () => {
      playTone(1200, 'sine', 0.04, 0.08);
    }),
  };

  // ============================================================
  // BGM — look-ahead scheduler + synth-first (MP3 subentra se carica)
  // ============================================================
  let bgmAudioEl    = null;  // elemento <audio> per MP3
  let _bgmInterval  = null;  // setInterval look-ahead
  let _bgmPatName   = null;  // nome pattern sintetico corrente
  let _bgmPatIdx    = 0;     // indice nota corrente
  let _bgmNextNote  = 0;     // prossima nota da schedulare (ctx.currentTime)
  let currentBgm    = null;

  const BGM_LOOKAHEAD = 0.5;  // secondi di anticipo scheduling
  const BGM_TICK_MS   = 100;  // tick ogni 100ms

  // Pattern melodici: array di [freq, durata] in secondi
  const BGM_PATTERNS = {
    map: [
      [330, 0.25], [392, 0.25], [440, 0.25], [494, 0.5],
      [440, 0.25], [392, 0.25], [349, 0.25], [330, 0.5],
      [294, 0.25], [330, 0.25], [392, 0.25], [440, 0.5],
      [494, 0.25], [440, 0.5], [0, 0.25],
    ],
  };

  function _stopBgmSynth() {
    if (_bgmInterval) { clearInterval(_bgmInterval); _bgmInterval = null; }
    _bgmPatName = null;
  }

  function _startBgmSynth(name) {
    const pattern = BGM_PATTERNS[name];
    if (!pattern) return;
    _stopBgmSynth();
    _bgmPatName  = name;
    _bgmPatIdx   = 0;
    _bgmNextNote = getCtx().currentTime + 0.05;

    _bgmInterval = setInterval(() => {
      if (!SETTINGS.bgmEnabled || _bgmPatName !== name) { _stopBgmSynth(); return; }
      const ctx = getCtx();
      if (ctx.state === 'suspended') return;
      // Reset se il timestamp è diventato stantio (tab in background, context sospeso, ecc.)
      if (_bgmNextNote < ctx.currentTime - 0.5) _bgmNextNote = ctx.currentTime + 0.05;
      const pat = BGM_PATTERNS[_bgmPatName];
      while (_bgmNextNote < ctx.currentTime + BGM_LOOKAHEAD) {
        const [freq, dur] = pat[_bgmPatIdx % pat.length];
        if (freq > 0) {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, _bgmNextNote);
          gain.gain.setValueAtTime(SETTINGS.bgmVolume * 0.6, _bgmNextNote);
          gain.gain.exponentialRampToValueAtTime(0.0001, _bgmNextNote + dur * 0.9);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(_bgmNextNote);
          osc.stop(_bgmNextNote + dur);
        }
        _bgmNextNote += dur;
        _bgmPatIdx++;
      }
    }, BGM_TICK_MS);
  }

  function stopBgm() {
    if (bgmAudioEl) { bgmAudioEl.pause(); bgmAudioEl.src = ''; bgmAudioEl = null; }
    _stopBgmSynth();
    currentBgm = null;
  }

  function playBgm(name) {
    if (!SETTINGS.bgmEnabled) return;
    if (currentBgm === name) return;
    stopBgm();
    currentBgm = name;

    // La sintesi parte immediatamente — nessuna latenza, nessun fetch
    _startBgmSynth(name);

    // Tenta MP3 in background: se carica con successo sostituisce la sintesi
    const url = MP3_BGM[name];
    if (url) {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = SETTINGS.bgmVolume;
      audio.addEventListener('canplaythrough', () => {
        if (currentBgm !== name) return; // schermata già cambiata
        _stopBgmSynth();                 // spegni sintesi
        bgmAudioEl = audio;              // subentra MP3
      }, { once: true });
      audio.addEventListener('error', () => {}, { once: true });
      audio.play().catch(() => {});
    }
  }

  function updateBgmVolume() {
    if (bgmAudioEl) bgmAudioEl.volume = SETTINGS.bgmVolume;
    // La sintesi legge SETTINGS.bgmVolume ad ogni nota — aggiornamento automatico
  }

  // ============================================================
  // RILEVAMENTO SCHERMATE
  // ============================================================
  let lastScreen = null;

  function onScreenChange(screenId) {
    if (screenId === lastScreen) return;
    log(`Schermata: ${screenId}`);
    const prev = lastScreen;
    lastScreen = screenId;

    // SFX per evento schermata — il BGM non viene mai interrotto dal cambio schermata
    if (screenId === 'battle-screen') {
      const title = document.getElementById('battle-title')?.textContent || '';
      if (title.includes('Gym') || title.includes('Big Boss') || title.includes('Final Boss')) {
        SFX.GYM();
      } else if (title.includes('Elite') || title.includes('Champion')) {
        SFX.LEGENDARY();
      } else if (title.includes('legendary') || title.includes('legendary'.toUpperCase())) {
        SFX.LEGENDARY();
      } else if (title.includes('wants to battle') || title.includes('Trainer:')) {
        SFX.TRAINER();
      } else {
        SFX.WILD();
      }
    }

    if (screenId === 'item-screen') SFX.ITEM();
    if (screenId === 'shiny-screen') {
      const content = document.getElementById('shiny-content')?.textContent || '';
      if (content.includes('Shiny')) SFX.SHINY();
      else SFX.TRADE(); // schermata trade usa shiny-screen
    }
    if (screenId === 'trade-screen') SFX.TRADE();
    if (screenId === 'badge-screen') _sfxOnce('badge', () => SFX.BADGE());
    if (screenId === 'win-screen') SFX.VICTORY();
    if (screenId === 'stat-buff-screen') SFX.SELECT();

    // Game over: ritorno al titolo dopo una battaglia = sconfitta
    if (prev === 'battle-screen' && screenId === 'title-screen') {
      SFX.GAMEOVER();
    }
  }

  // ============================================================
  // OBSERVER PER EVENTI BATTAGLIA (level up, faint, etc.)
  // ============================================================
  function initBattleObserver() {
    // Osserva i log di battaglia per eventi specifici
    const battleField = document.getElementById('player-side');
    if (!battleField) {
      setTimeout(initBattleObserver, 1000);
      return;
    }

    const obs = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const cls = typeof node.className === 'string' ? node.className : (node.className?.baseVal ?? '');
          // Level up animation
          if (cls.includes('levelup') || node.textContent?.includes('grew to')) {
            _sfxOnce('levelup', () => SFX.LEVELUP());
          }
          // Faint SOLO del player (ignora pokémon avversario)
          if (node.closest && node.closest('#player-side') &&
              (cls.includes('fainted') || node.textContent?.includes('fainted'))) {
            SFX.FAINT();
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Observer per toast di sistema (level up, notifiche mappa, etc.)
  function initToastObserver() {
    const obs = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const cls = typeof node.className === 'string' ? node.className : (node.className?.baseVal ?? '');
          const text = node.textContent || '';

          if (cls.includes('levelup-toast') || cls.includes('level-up')) {
            _sfxOnce('levelup', () => SFX.LEVELUP());
          }
          if (cls.includes('item-found-toast')) {
            SFX.ITEM();
          }
          if (cls.includes('achievement-toast') || cls.includes('ach-toast')) {
            _sfxOnce('badge', () => SFX.BADGE());
          }
          if (text.includes('healed') || text.includes('pokecenter') || cls.includes('pokecenter')) {
            _sfxOnce('heal', () => SFX.HEAL());
          }
          if (cls.includes('bug-levelup') || cls.includes('map-notification')) {
            if (text.includes('grew to') || text.includes('leveled')) _sfxOnce('levelup', () => SFX.LEVELUP());
          }
          if (text.includes('fully healed')) {
            _sfxOnce('heal', () => SFX.HEAL());
          }
          // faint non gestito qui: viene rilevato in initBattleObserver solo per il player
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Click su carte pokémon nello starter select → suona SELECT
  function initClickSounds() {
    document.addEventListener('click', (e) => {
      getCtx(); // risveglia il contesto audio al primo click

      // Primo click: avvia BGM + precarica SFX (richiede gesture per AudioContext)
      if (!_sfxPreloaded) {
        _sfxPreloaded = true;
        setTimeout(preloadAllSfx, 1000);
      }

      const target = e.target;

      // Bottoni primari → click sound
      if (target.closest('.btn-primary, .btn-secondary, .equip-btn, .hof-sort-btn')) {
        SFX.CLICK();
      }

      // Selezione starter
      if (target.closest('.poke-card') && lastScreen === 'starter-screen') {
        SFX.SELECT();
      }

      // Cattura pokémon
      if (target.closest('.poke-card') && lastScreen === 'catch-screen') {
        SFX.CATCH();
      }

      // Nodi mappa
      if (target.closest('circle, rect, .map-node, g[transform]')) {
        SFX.CLICK();
      }
    }, true);
  }


  // PANNELLO UI UNIFICATO
  let panelVisible = false;
  let activeTab = 'audio';

  function createPanel() {
    if (!document.body) { setTimeout(createPanel, 300); return; }
    const legacy = document.getElementById('poke-audio-panel');
    if (legacy) legacy.remove();
    if (document.getElementById('pkt-panel')) return;
    const bfSlidersHtml = ['hp','atk','def','speed','special'].map(s =>
      '<div class="pkt-row" style="margin-bottom:4px"><span class="pkt-stat-label">' +
      (s === 'special' ? 'SPC' : s === 'speed' ? 'SPD' : s.toUpperCase()) +
      '</span><input type="range" id="bf-stat-' + s + '" min="0" max="10" value="0" class="pkt-slider" style="flex:1">' +
      '<span id="bf-val-' + s + '" class="pkt-stat-val">0</span></div>'
    ).join('');
    const SVG = {
      toggle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c050ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      audio: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      dex: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      starter: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      ev: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      kofi: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    };
    const panel = document.createElement('div');
    panel.id = 'pkt-panel';
    panel.innerHTML = [
      '<div id="pkt-toggle" title="PokeLike Toolkit">' + SVG.toggle + '</div>',
      '<div id="pkt-body" style="display:none">',
      '<div class="pkt-header">PokeLike Toolkit v6.0.1</div>',
      '<div class="pkt-tabs">',
      '<button class="pkt-tab active" data-tab="audio" title="Audio">' + SVG.audio + '</button>',
      '<button class="pkt-tab" data-tab="dex" title="Pokedex">' + SVG.dex + '</button>',
      '<button class="pkt-tab" data-tab="starter" title="Starter PC">' + SVG.starter + '</button>',
      '<button class="pkt-tab" data-tab="ev" title="EV / Buff">' + SVG.ev + '</button>',
      '</div><div class="pkt-tab-panels">',
      '<div class="pkt-tab-panel active" data-panel="audio">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">Audio Engine</div><div class="pkt-tab-desc">SFX personalizzati e controllo volume musica di gioco.</div></div>',
      '<div class="pkt-section"><div class="pkt-label-row">SFX<input type="checkbox" id="pau-sfx-toggle" ' + (SETTINGS.sfxEnabled ? 'checked' : '') + '></div>',
      '<input type="range" id="pau-sfx-vol" min="0" max="1" step="0.01" value="' + SETTINGS.sfxVolume + '" class="pkt-slider"></div>',
      '<div class="pkt-section"><div class="pkt-label-row">Musica gioco<input type="checkbox" id="pau-game-bgm-toggle" ' + (SETTINGS.gameBgmEnabled ? 'checked' : '') + '></div>',
      '<input type="range" id="pau-game-bgm-vol" min="0" max="1" step="0.01" value="' + SETTINGS.gameBgmVolume + '" class="pkt-slider"></div>',
      '<div class="pkt-footer"><button id="pau-test-sfx" class="pkt-btn pkt-full">Test SFX</button></div></div>',
      '<div class="pkt-tab-panel" data-panel="dex">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">DexFaker</div><div class="pkt-tab-desc">Aggiungi un Pokemon al Pokedex per N. o nome.</div></div>',
      '<div class="pkt-section"><div class="pkt-label">N. Pokedex o nome</div>',
      '<div class="pkt-row"><input type="text" id="df-input" placeholder="es. 25 o Pikachu" class="pkt-input">',
      '<button id="df-single-btn" class="pkt-btn">Cattura</button></div></div>',
      '<div class="pkt-section"><label class="pkt-check-row"><input type="checkbox" id="df-shiny-chk" ' + (TOOLS.dfShiny ? 'checked' : '') + '><span>Aggiungi anche versione Shiny</span></label></div>',
      '<div class="pkt-section"><div id="df-status" class="pkt-status">-</div></div></div>',
      '<div class="pkt-tab-panel" data-panel="starter">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">StarterPC</div><div class="pkt-tab-desc">Aggiungi Pokemon al PC della Battle Tower come starter.</div></div>',
      '<div class="pkt-section"><label class="pkt-check-row pkt-main"><input type="checkbox" id="spc-enabled" ' + (TOOLS.spcEnabled ? 'checked' : '') + '><span>Abilita StarterPC</span></label></div>',
      '<div class="pkt-section"><label class="pkt-check-row"><input type="checkbox" id="spc-shiny-chk" ' + (TOOLS.spcShiny ? 'checked' : '') + '><span>Mostrali come Shiny</span></label></div>',
      '<div class="pkt-section"><div class="pkt-label">N. Pokedex o nome</div>',
      '<div class="pkt-row"><input type="text" id="spc-input" placeholder="es. 25 o Pikachu" class="pkt-input"><button id="spc-add" class="pkt-btn">Imposta</button></div>',
      '<div id="spc-current" class="pkt-hint" style="margin-top:6px">Nessun Pokemon selezionato</div>',
      '<button id="spc-clear" class="pkt-btn pkt-full" style="margin-top:4px;display:none">Rimuovi</button>',
      '<div id="spc-individual-status" class="pkt-hint" style="margin-top:4px"></div></div></div>',
      '<div class="pkt-tab-panel" data-panel="ev">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">BuffFaker</div><div class="pkt-tab-desc">Modifica gli EV/stat buff per singolo Pokemon.</div></div>',
      '<div class="pkt-section"><div class="pkt-label">N. Pokedex o nome</div>',
      '<div class="pkt-row"><input type="text" id="bf-input" placeholder="es. 137 o Porygon" class="pkt-input"><button id="bf-load-btn" class="pkt-btn">Carica</button></div>',
      '<div id="bf-name" class="pkt-hint" style="margin-top:4px"></div></div>',
      '<div class="pkt-section" id="bf-sliders" style="display:none">' + bfSlidersHtml,
      '<div class="pkt-row" style="margin-top:6px;gap:4px"><button id="bf-apply-btn" class="pkt-btn pkt-full">Applica</button>',
      '<button id="bf-max-btn" class="pkt-btn pkt-full">Max tutto</button></div></div>',
      '<div class="pkt-section"><div id="bf-status" class="pkt-status">-</div></div></div>',
      '</div>',
      '<a href="https://ko-fi.com/erry96" target="_blank" rel="noopener" class="pkt-kofi" title="Supporta su Ko-fi">' + SVG.kofi + '<span>Supporta su Ko-fi</span></a>',
      '</div></div>',
    ].join('');
    const style = document.createElement('style');
    style.textContent = '#pkt-panel{position:fixed;bottom:12px;left:12px;z-index:99999;font-family:"Press Start 2P",monospace,sans-serif;font-size:9px}#pkt-toggle{width:36px;height:36px;background:#1a0e2e;border:2px solid #c050ff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 8px #c050ff44;transition:transform .2s;user-select:none}#pkt-toggle:hover{transform:scale(1.1)}#pkt-body{position:absolute;bottom:44px;left:0;background:#100820;border:2px solid #c050ff;border-radius:8px;padding:12px 14px;min-width:240px;max-width:280px;max-height:80vh;overflow-y:auto;box-shadow:0 0 16px #c050ff33;color:#e0b0ff}.pkt-header{font-size:7px;letter-spacing:1px;color:#c050ff;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #c050ff33;text-align:center}.pkt-tabs{display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid #c050ff33;padding-bottom:6px}.pkt-tab{flex:1;background:#1e103a;border:1px solid #9060cc;color:#9060cc;font-family:inherit;padding:6px 2px;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center}.pkt-tab svg{display:block}.pkt-tab:hover{background:#2e1a50}.pkt-tab.active{background:#c050ff22;border-color:#c050ff;color:#e0b0ff}.pkt-tab-panel{display:none}.pkt-tab-panel.active{display:block}.pkt-tab-head{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #c050ff22}.pkt-tab-title{font-size:8px;color:#c050ff;margin-bottom:4px}.pkt-tab-desc{font-size:6px;color:#7050aa;line-height:1.8}.pkt-section{margin-bottom:8px}.pkt-label{font-size:7px;color:#9060cc;margin-bottom:4px}.pkt-label-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;color:#c8a0ff;font-size:7px}.pkt-hint{font-size:6px;color:#7050aa;line-height:1.7}.pkt-row{display:flex;gap:6px;align-items:center}.pkt-check-row{display:flex;gap:6px;align-items:center;cursor:pointer;font-size:7px;color:#e0b0ff;margin-bottom:3px}.pkt-check-row.pkt-main{font-size:8px;color:#c050ff;margin-bottom:5px}.pkt-input{flex:1;min-width:0;background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 6px;border-radius:3px}.pkt-select{width:100%;background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 6px;border-radius:3px;cursor:pointer}.pkt-btn{background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 8px;border-radius:3px;cursor:pointer;white-space:nowrap}.pkt-btn:hover{background:#2e1a50}.pkt-btn.pkt-full{width:100%;display:block}.pkt-btn-red{border-color:#ff4444;color:#ff9999}.pkt-btn-red:hover{background:#3a0a0a}.pkt-status{font-size:7px;color:#a080d0;min-height:12px;word-break:break-all}.pkt-progress{font-size:9px;color:#c050ff;margin-top:3px;font-weight:bold}.pkt-slider{width:100%;accent-color:#c050ff;cursor:pointer}.pkt-stat-label{width:28px;font-size:6px;color:#9060cc}.pkt-stat-val{width:14px;text-align:right;font-size:7px}.pkt-footer{margin-top:6px;border-top:1px solid #c050ff33;padding-top:6px}.spc-ind-list{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:72px;overflow-y:auto}.spc-ind-tag{display:inline-flex;align-items:center;gap:3px;background:#1e103a;border:1px solid #9060cc;border-radius:3px;padding:2px 4px;font-size:6px;color:#c8a0ff}.spc-ind-rm{background:none;border:none;color:#ff8888;cursor:pointer;font-size:8px;padding:0 1px;line-height:1}.spc-ind-rm:hover{color:#ff4444}.pkt-kofi{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:10px;padding-top:8px;border-top:1px solid #c050ff33;font-size:6px;color:#ff5e5b;text-decoration:none}.pkt-kofi:hover{color:#ff8a88}.pkt-kofi svg{flex-shrink:0}';
    document.head.appendChild(style);
    document.body.appendChild(panel);
    const bodyEl = document.getElementById('pkt-body');
    document.getElementById('pkt-toggle').addEventListener('click', () => {
      panelVisible = !panelVisible;
      bodyEl.style.display = panelVisible ? 'block' : 'none';
    });
    document.querySelectorAll('.pkt-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.pkt-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
        document.querySelectorAll('.pkt-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
      });
    });
    document.getElementById('pau-sfx-toggle').addEventListener('change', e => { SETTINGS.sfxEnabled = e.target.checked; saveSettings(); });
    document.getElementById('pau-sfx-vol').addEventListener('input', e => { SETTINGS.sfxVolume = parseFloat(e.target.value); saveSettings(); });
    document.getElementById('pau-game-bgm-toggle').addEventListener('change', e => { SETTINGS.gameBgmEnabled = e.target.checked; saveSettings(); applyGameBgmVolume(); });
    document.getElementById('pau-game-bgm-vol').addEventListener('input', e => { SETTINGS.gameBgmVolume = parseFloat(e.target.value); saveSettings(); applyGameBgmVolume(); });
    document.getElementById('pau-test-sfx').addEventListener('click', () => SFX.BADGE());
    const statusEl = document.getElementById('df-status');
    document.getElementById('df-shiny-chk').addEventListener('change', e => { TOOLS.dfShiny = e.target.checked; saveTools(); });
    document.getElementById('df-single-btn').addEventListener('click', async () => {
      const input = document.getElementById('df-input');
      const shiny = document.getElementById('df-shiny-chk').checked;
      statusEl.textContent = 'Ricerca...';
      const res = await _resolvePokeId(input.value);
      if (!res.ok) { statusEl.textContent = res.msg; return; }
      try {
        const name = await _dfSimulate(res.id, shiny);
        if (typeof window.checkDexAchievements === 'function') window.checkDexAchievements();
        statusEl.textContent = name + ' aggiunto!' + (shiny ? ' + Shiny' : '');
        input.value = '';
        _refreshSoon();
      } catch { statusEl.textContent = '#' + res.id + ' non trovato'; }
    });
    document.getElementById('df-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('df-single-btn').click(); }
    });
    const spcCurrentEl = document.getElementById('spc-current');
    const spcClearBtn = document.getElementById('spc-clear');
    const spcIndStatusEl = document.getElementById('spc-individual-status');
    async function renderSpcCurrent() {
      const ids = spcBuildIds();
      if (ids.length === 0) {
        spcCurrentEl.textContent = 'Nessun Pokemon selezionato';
        spcClearBtn.style.display = 'none';
        return;
      }
      spcClearBtn.style.display = 'block';
      const id = ids[0];
      try {
        const data = await _fetchPoke(id);
        spcCurrentEl.textContent = '#' + id + ' ' + data.name;
      } catch {
        spcCurrentEl.textContent = '#' + id;
      }
    }
    renderSpcCurrent();
    document.getElementById('spc-enabled').addEventListener('change', e => { TOOLS.spcEnabled = e.target.checked; saveTools(); });
    document.getElementById('spc-shiny-chk').addEventListener('change', e => { TOOLS.spcShiny = e.target.checked; saveTools(); });
    spcClearBtn.addEventListener('click', () => {
      spcClearIndividual();
      renderSpcCurrent();
      spcIndStatusEl.textContent = 'Pokemon rimosso';
    });
    document.getElementById('spc-add').addEventListener('click', async () => {
      const input = document.getElementById('spc-input');
      spcIndStatusEl.textContent = 'Ricerca...';
      const resolved = await _resolvePokeId(input.value);
      if (!resolved.ok) { spcIndStatusEl.textContent = resolved.msg; return; }
      const res = spcSetIndividual(resolved.id);
      if (!res.ok) { spcIndStatusEl.textContent = res.msg; return; }
      const label = resolved.name || ('#' + resolved.id);
      spcIndStatusEl.textContent = label + ' impostato - refresh...';
      input.value = '';
      await renderSpcCurrent();
      _refreshSoon();
    });
    document.getElementById('spc-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('spc-add').click(); }
    });
    const bfStatusEl = document.getElementById('bf-status');
    const bfSlidersEl = document.getElementById('bf-sliders');
    const bfNameEl = document.getElementById('bf-name');
    let _bfCurrentId = null;
    BF_STATS.forEach(s => {
      const el = document.getElementById('bf-stat-' + s);
      const vl = document.getElementById('bf-val-' + s);
      if (el && vl) el.addEventListener('input', () => { vl.textContent = el.value; });
    });
    document.getElementById('bf-load-btn').addEventListener('click', async () => {
      const input = document.getElementById('bf-input');
      bfStatusEl.textContent = 'Ricerca...';
      bfNameEl.textContent = ''; bfSlidersEl.style.display = 'none';
      const res = await _resolvePokeId(input.value);
      if (!res.ok) { bfStatusEl.textContent = res.msg; return; }
      try {
        const data = await _fetchPoke(res.id);
        _bfCurrentId = data.id;
        bfNameEl.textContent = '#' + data.id + ' ' + data.name;
        _bfShowCurrentBuffs(data.id);
        bfSlidersEl.style.display = 'block';
        bfStatusEl.textContent = 'Modifica i valori e clicca Applica';
      } catch { bfNameEl.textContent = 'Non trovato'; bfStatusEl.textContent = ''; }
    });
    document.getElementById('bf-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('bf-load-btn').click(); }
    });
    document.getElementById('bf-apply-btn').addEventListener('click', async () => {
      if (!_bfCurrentId) return;
      await _bfApply(_bfCurrentId, _bfReadSliders());
      bfStatusEl.textContent = 'Buff applicati a #' + _bfCurrentId;
      _refreshSoon();
    });
    document.getElementById('bf-max-btn').addEventListener('click', async () => {
      if (!_bfCurrentId) return;
      BF_STATS.forEach(s => {
        const el = document.getElementById('bf-stat-' + s);
        const vl = document.getElementById('bf-val-' + s);
        if (el) el.value = 10;
        if (vl) vl.textContent = '10';
      });
      await _bfApply(_bfCurrentId, Object.fromEntries(BF_STATS.map(s => [s, 10])));
      bfStatusEl.textContent = 'Tutto maxato per #' + _bfCurrentId;
      _refreshSoon();
    });
  }

  function log(msg, color) {
    if (color === undefined) color = '#9b59b6';
    console.log('%c[POKE-TOOLKIT] ' + msg, 'background:#1a0a2e;color:' + color + ';font-weight:bold;padding:2px 5px;border:1px solid ' + color + ';');
  }

  function init() {
    try {
    log('PokeLike Toolkit v6.0.1 avviato', '#2ecc71');
    watchMaintenanceBypass();
    injectInstantScreenCSS();
    patchGameTransitions();
    watchGameBgm();
    stopBgm();
    createPanel();
    let spcAttempts = 0;
    const waitSpc = setInterval(() => {
      spcAttempts++;
      if (typeof window.getHallOfFame === 'function') {
        clearInterval(waitSpc);
        applySpcPatches();
        log('StarterPC patch applicata', '#2ecc71');
      } else if (spcAttempts > 40) clearInterval(waitSpc);
    }, 500);
    function watchScreens() {
      const screens = document.querySelectorAll('.screen');
      if (screens.length === 0) { setTimeout(watchScreens, 500); return; }
      const obs = new MutationObserver(() => {
        const active = document.querySelector('.screen.active');
        if (active) onScreenChange(active.id);
      });
      screens.forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
      log('Observer schermate (' + screens.length + ' trovate)', '#2ecc71');
      const activeNow = document.querySelector('.screen.active');
      if (activeNow) onScreenChange(activeNow.id);
    }
    watchScreens();
    initBattleObserver();
    initToastObserver();
    initClickSounds();
    } catch (err) {
      console.error('[POKE-TOOLKIT] Errore init:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

})();
