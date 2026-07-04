// ==UserScript==
// @name         PokeLike Toolkit
// @namespace    http://tampermonkey.net/
// @version      6.3.2
// @description  Audio engine + DexFaker + StarterPC + BuffFaker + Item catalog + Save backup per pokelike.xyz
// @author       Erry96
// @match        https://pokelike.xyz/*
// @match        https://www.pokelike.xyz/*
// @updateURL    https://deven-debug.github.io/pokelike-audio/script/pokelike-audio.user.js
// @downloadURL  https://deven-debug.github.io/pokelike-audio/script/pokelike-audio.user.js
// @connect      pokeapi.co
// @connect      www.youtube.com
// @connect      i.ytimg.com
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

  try {
    console.log('%c[POKE-TOOLKIT] carico v6.3.2', 'background:#1a0a2e;color:#2ecc71;font-weight:bold;padding:2px 6px;border:1px solid #2ecc71');
  } catch (_) {}

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
  const TOOLS = { dfShiny: false, spcEnabled: false, spcShiny: false, spcIndividuals: [], spcInjection: null };
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
    TOOLS.spcEnabled = true;
    saveTools();
    return { ok: true, id: n };
  }
  function spcClearIndividual() {
    TOOLS.spcIndividuals = [];
    saveTools();
    _spcSyncToStorage();
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
  function _spcIsLegendary(speciesId) {
    const root = typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(speciesId) : speciesId;
    if (typeof window.LEGENDARY_ID_SET !== 'undefined') return window.LEGENDARY_ID_SET.has(root);
    if (Array.isArray(window.LEGENDARY_IDS)) return window.LEGENDARY_IDS.includes(root) || window.LEGENDARY_IDS.includes(speciesId);
    return false;
  }

  function _spcReadIndex() {
    try {
      const idx = JSON.parse(localStorage.getItem('poke_hof_index') || '{}');
      if (!Array.isArray(idx.evoLineRoots)) idx.evoLineRoots = [];
      if (!Array.isArray(idx.shinySpecies)) idx.shinySpecies = [];
      if (!Array.isArray(idx.eggLegendaries)) idx.eggLegendaries = [];
      if (!Array.isArray(idx.eggLegendaryShinies)) idx.eggLegendaryShinies = [];
      if (!Array.isArray(idx.starterRuns)) idx.starterRuns = [];
      return idx;
    } catch {
      return { evoLineRoots: [], shinySpecies: [], eggLegendaries: [], eggLegendaryShinies: [], starterRuns: [] };
    }
  }

  function _spcRemoveInjection(idx, inj) {
    if (!inj) return idx;
    const drop = (arr, val) => (arr || []).filter(x => x !== val);
    if (inj.root != null) idx.evoLineRoots = drop(idx.evoLineRoots, inj.root);
    if (inj.speciesId != null) idx.shinySpecies = drop(idx.shinySpecies, inj.speciesId);
    if (inj.legendary && inj.root != null) {
      idx.eggLegendaries = drop(idx.eggLegendaries, inj.root);
      idx.eggLegendaryShinies = drop(idx.eggLegendaryShinies, inj.root);
    }
    return idx;
  }

  function _spcAddUnique(arr, val) {
    if (!arr.includes(val)) arr.push(val);
    return arr;
  }

  function _spcSyncToStorage() {
    let idx = _spcReadIndex();
    idx = _spcRemoveInjection(idx, TOOLS.spcInjection);
    TOOLS.spcInjection = null;

    const ids = spcBuildIds();
    if (TOOLS.spcEnabled && ids.length) {
      const speciesId = ids[0];
      const root = typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(speciesId) : speciesId;
      const legendary = _spcIsLegendary(speciesId);
      _spcAddUnique(idx.evoLineRoots, root);
      if (TOOLS.spcShiny) _spcAddUnique(idx.shinySpecies, speciesId);
      if (legendary) {
        _spcAddUnique(idx.eggLegendaries, root);
        if (TOOLS.spcShiny) _spcAddUnique(idx.eggLegendaryShinies, root);
      }
      TOOLS.spcInjection = { root, speciesId, legendary, shiny: !!TOOLS.spcShiny };
    }

    saveTools();
    try {
      localStorage.setItem('poke_hof_index', JSON.stringify(idx));
      if (typeof window.syncToCloud === 'function') window.syncToCloud();
    } catch (err) {
      console.error('[POKE-TOOLKIT] StarterPC storage:', err);
    }
  }

  function _spcFakeEntry() {
    const ids = spcBuildIds();
    if (ids.length === 0) return null;
    const speciesId = ids[0];
    const root = typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(speciesId) : speciesId;
    const legendary = _spcIsLegendary(speciesId);
    const member = { speciesId, level: 5 };
    if (TOOLS.spcShiny) member.isShiny = 1;
    const entry = {
      _starterpc_fake: true,
      savedAt: Date.now(),
      runNumber: 0,
      hardMode: false,
      endless: true,
      stageNumber: 1,
      starterSpeciesId: speciesId,
      date: '',
      team: [member],
    };
    if (legendary) entry.source = 'egg';
    return entry;
  }

  function _spcPatchHofIndex(real) {
    const ids = spcBuildIds();
    if (!ids.length) return real;
    const speciesId = ids[0];
    const root = typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(speciesId) : speciesId;
    const legendary = _spcIsLegendary(speciesId);
    const idx = { ...real };
    const roots = new Set(idx.evoLineRoots || []);
    roots.add(root);
    idx.evoLineRoots = [...roots];
    if (TOOLS.spcShiny) {
      const shinies = new Set(idx.shinySpecies || []);
      shinies.add(speciesId);
      idx.shinySpecies = [...shinies];
    }
    if (legendary) {
      const eggs = new Set(idx.eggLegendaries || []);
      eggs.add(root);
      idx.eggLegendaries = [...eggs];
      if (TOOLS.spcShiny) {
        const eggShiny = new Set(idx.eggLegendaryShinies || []);
        eggShiny.add(root);
        idx.eggLegendaryShinies = [...eggShiny];
      }
    }
    return idx;
  }

  let _spcPatched = false;
  let _spcOrigGetHof = null;
  let _spcOrigGetHofIndex = null;
  let _spcOrigOpenHof = null;
  let _spcOrigFetchPokemon = null;

  function _spcResolveFetchId(requestedId) {
    if (!TOOLS.spcEnabled) return requestedId;
    const ids = spcBuildIds();
    if (!ids.length) return requestedId;
    const speciesId = ids[0];
    const root = typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(speciesId) : speciesId;
    const req = Number(requestedId);
    if (req === root || req === speciesId) return speciesId;
    return requestedId;
  }

  function applySpcPatches() {
    if (typeof window.getHallOfFame !== 'function') return false;
    if (_spcPatched) return true;

    _spcOrigGetHof = window.getHallOfFame;
    _spcOrigGetHofIndex = typeof window.getHofIndex === 'function' ? window.getHofIndex : null;
    _spcOrigOpenHof = window.openHallOfFameModal;
    if (typeof window.fetchPokemonById === 'function') {
      _spcOrigFetchPokemon = window.fetchPokemonById;
      window.fetchPokemonById = async function (id) {
        return _spcOrigFetchPokemon(_spcResolveFetchId(id));
      };
    }

    function patchedGetHof() {
      const real = _spcOrigGetHof();
      if (!TOOLS.spcEnabled) return real;
      const fake = _spcFakeEntry();
      return fake ? [...real, fake] : real;
    }

    function patchedGetHofIndex() {
      const real = _spcOrigGetHofIndex ? _spcOrigGetHofIndex() : {};
      if (!TOOLS.spcEnabled) return real;
      return _spcPatchHofIndex(real);
    }

    window.getHallOfFame = patchedGetHof;
    if (_spcOrigGetHofIndex) window.getHofIndex = patchedGetHofIndex;
    window.openHallOfFameModal = function () {
      window.getHallOfFame = _spcOrigGetHof;
      if (_spcOrigGetHofIndex) window.getHofIndex = _spcOrigGetHofIndex;
      try {
        if (typeof _spcOrigOpenHof === 'function') _spcOrigOpenHof();
      } finally {
        window.getHallOfFame = patchedGetHof;
        if (_spcOrigGetHofIndex) window.getHofIndex = patchedGetHofIndex;
      }
    };

    _spcPatched = true;
    return true;
  }

  function ensureSpcPatches() {
    const sync = () => { if (TOOLS.spcEnabled && spcBuildIds().length) _spcSyncToStorage(); };
    if (applySpcPatches()) { sync(); return; }
    let attempts = 0;
    const wait = setInterval(() => {
      attempts++;
      if (applySpcPatches()) { sync(); clearInterval(wait); }
      else if (attempts > 120) clearInterval(wait);
    }, 500);
  }
  const BF_STATS = ['hp', 'atk', 'def', 'special', 'spdef', 'speed'];
  const BF_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', special: 'SpA', spdef: 'SpD', speed: 'Spe' };
  const BF_DEFAULT = { hp: 0, atk: 0, def: 0, special: 0, spdef: 0, speed: 0 };

  const ITEM_CATALOG = [
    { id: 'assault_vest', name: 'Assault Vest', desc: '+50% Difesa Speciale', icon: '🦺' },
    { id: 'black_belt', name: 'Black Belt', desc: '+50% danno mosse Lotta', icon: '🥋' },
    { id: 'charcoal', name: 'Charcoal', desc: '+50% danno mosse Fuoco', icon: '🔥' },
    { id: 'choice_band', name: 'Choice Band', desc: '+40% danno fisico, -20% DEF', icon: '🎀' },
    { id: 'choice_scarf', name: 'Choice Scarf', desc: '+50% Velocita', icon: '🧣' },
    { id: 'choice_specs', name: 'Choice Specs', desc: '+30% danno speciale', icon: '👓' },
    { id: 'eviolite', name: 'Eviolite', desc: 'Blocca evo: +50% DEF e Sp.Def', icon: '💎' },
    { id: 'expert_belt', name: 'Expert Belt', desc: '+100% danno su superefficaci', icon: '🥊' },
    { id: 'focus_sash', name: 'Focus Sash', desc: 'A PS pieni, sopravvivi con 1 PS', icon: '🎽' },
    { id: 'kings_rock', name: 'King\'s Rock', desc: '30% chance tentennamento', icon: '👑' },
    { id: 'lagging_tail', name: 'Lagging Tail', desc: 'Sempre ultimo, +100% danno', icon: '🐌' },
    { id: 'leftovers', name: 'Leftovers', desc: 'Recupera 10% PS max/turno', icon: '🍃' },
    { id: 'life_orb', name: 'Life Orb', desc: '+30% danno, -10% PS per colpo', icon: '🌑' },
    { id: 'loaded_dice', name: 'Loaded Dice', desc: 'Inizio lotta: 37% +2 stat o -1', icon: '🎲' },
    { id: 'lucky_egg', name: 'Lucky Egg', desc: '+30% chance livello extra', icon: '🥚' },
    { id: 'magnet', name: 'Magnet', desc: '+50% danno mosse Elettro', icon: '🧲' },
    { id: 'metal_coat', name: 'Metal Coat', desc: '+50% danno mosse Acciaio', icon: '🔩' },
    { id: 'metronome', name: 'Metronome', desc: 'Dual-type: altro tipo, +20%', icon: '🎵' },
    { id: 'miracle_seed', name: 'Miracle Seed', desc: '+50% danno mosse Erba', icon: '🌱' },
    { id: 'moon_stone', name: 'Moon Stone', desc: 'Forza evoluzione', icon: '🌙' },
    { id: 'mystic_water', name: 'Mystic Water', desc: '+50% danno mosse Acqua', icon: '💧' },
    { id: 'pixie_plate', name: 'Pixie Plate', desc: '+50% danno mosse Folletto', icon: '✨' },
    { id: 'quick_claw', name: 'Quick Claw', desc: '50% chance attaccare per primo', icon: '🪝' },
    { id: 'rare_candy', name: 'Rare Candy', desc: '+3 livelli', icon: '🍬', usable: true },
    { id: 'red_card', name: 'Red Card', desc: '-50% danno da superefficaci', icon: '🟥' },
    { id: 'rocky_helmet', name: 'Rocky Helmet', desc: 'Attaccante -12% PS max/colpo', icon: '⛑️' },
    { id: 'scope_lens', name: 'Scope Lens', desc: '+20% crit, crit +50% danno', icon: '🔭' },
    { id: 'sharp_beak', name: 'Sharp Beak', desc: '+50% danno mosse Volante', icon: '🦅' },
    { id: 'shell_bell', name: 'Shell Bell', desc: 'Cura 15% danno inflitto', icon: '🐚' },
    { id: 'silk_scarf', name: 'Silk Scarf', desc: '+50% danno mosse Normale', icon: '🤍' },
    { id: 'silver_powder', name: 'Silver Powder', desc: '+50% danno mosse Coleottero', icon: '🦋' },
    { id: 'tm_normal', name: 'TM', desc: 'Aumenta move tier di 1', icon: '💿', usable: true },
    { id: 'twisted_spoon', name: 'Twisted Spoon', desc: '+50% danno mosse Psico', icon: '🥄' },
    { id: 'wide_lens', name: 'Wide Lens', desc: '+20% danno tutte le mosse', icon: '🔎' },
    { id: 'adrenaline_orb', name: 'Adrenaline Orb', desc: 'Su superefficace: +1 ATK e Sp.Atk', icon: '⚡' },
    { id: 'power_bracer', name: 'Power Bracer', desc: 'Pokemon infliggono +2 danno', icon: '💪', passive: true },
    { id: 'bright_powder', name: 'Bright Powder', desc: 'Effetto passivo sulla mappa', icon: '🥽', passive: true },
    { id: 'atk_band', name: 'Attack Band', desc: 'Bonus danno fisico', icon: '🥋', passive: true },
    { id: 'sharp_beak_pass', name: 'Sharp Beak', desc: '+50% danno Volante (passivo)', icon: '🪶', passive: true },
    { id: 'shoal_salt', name: 'Shoal Salt', desc: 'Effetto passivo sulla mappa', icon: '⚪', passive: true },
    { id: 'lucky_punch', name: 'Lucky Punch', desc: 'Chance crit extra', icon: '🥊', passive: true },
    { id: 'light_ball', name: 'Light Ball', desc: 'Potenzia Pokemon Elettro', icon: '✨', passive: true },
    { id: 'thick_club', name: 'Thick Club', desc: 'Normal infliggono piu danno', icon: '🔨', passive: true },
    { id: 'light_clay', name: 'Light Clay', desc: 'Riduce danno da mosse speciali', icon: '🦺', passive: true },
    { id: 'cell_battery', name: 'Cell Battery', desc: 'Bonus stat dopo colpo Elettro', icon: '🔋', passive: true },
    { id: 'electric_seed', name: 'Electric Seed', desc: 'Mosse Elettro colpiscono due volte', icon: '⚡', passive: true },
    { id: 'yache_berry', name: 'Yache Berry', desc: 'Boost stat dopo attacco Ghiaccio', icon: '🍇', passive: true },
    { id: 'grepa_berry', name: 'Grepa Berry', desc: 'Nemico nerfato quando colpito', icon: '🌿', passive: true },
    { id: 'shell_bell_pass', name: 'Shell Bell', desc: 'Danno ridotto ma attacchi potenziati', icon: '🍃', passive: true },
    { id: 'leaf_stone', name: 'Leaf Stone', desc: 'Erba: cura a fine turno', icon: '🌿', passive: true },
    { id: 'grass_spore', name: 'Grass Spore', desc: 'Addormenta invece di attaccare', icon: '😴', passive: true },
    { id: 'big_mushroom', name: 'Big Mushroom', desc: 'Danno extra ma ferisce il team', icon: '🍄', passive: true },
    { id: 'sitrus_berry', name: 'Sitrus Berry', desc: 'Cura tutto il team', icon: '❤️', passive: true },
    { id: 'figy_berry', name: 'Figy Berry', desc: 'Cura quando un alleato va KO', icon: '🍑', passive: true },
    { id: 'mind_plate', name: 'Mind Plate', desc: 'Mosse Psico possono crittare', icon: '🧠', passive: true },
    { id: 'splash_crit', name: 'Splash Plate', desc: 'Splash diventa critico', icon: '🔍', passive: true },
    { id: 'hp_priority', name: 'HP Priority', desc: 'Pokemon con piu PS attacca prima', icon: '🦞', passive: true },
    { id: 'execute_dmg', name: 'Execute Orb', desc: 'Bonus danno su nemici deboli', icon: '🥋', passive: true },
    { id: 'ghost_heal', name: 'Ghost Heal', desc: 'Spettro: cura pari al danno', icon: '👻', passive: true },
    { id: 'ghost_curse', name: 'Ghost Curse', desc: 'Effetto maledizione Spettro', icon: '💀', passive: true },
    { id: 'ko_boost', name: 'KO Boost', desc: 'KO nemico: bonus al team', icon: '⚫', passive: true },
    { id: 'flying_speed', name: 'Sky Plate', desc: 'Volante: +50% velocita', icon: '🌫️', passive: true },
    { id: 'shed_shell', name: 'Shed Shell', desc: 'Colpi riducono livello nemico', icon: '🐛', passive: true },
    { id: 'reaper_cloth', name: 'Reaper Cloth', desc: 'Una volta per run: potere Spettro', icon: '🪦', passive: true },
    { id: 'safety_goggles', name: 'Safety Goggles', desc: 'Buio: bonus livello crit', icon: '🕶️', passive: true },
    { id: 'dark_splash', name: 'Dark Splash', desc: 'Bonus danno Buio', icon: '🌑', passive: true },
    { id: 'crit_lifesteal', name: 'Oran Berry', desc: 'Crit: cura dal danno', icon: '🫐', passive: true },
    { id: 'rocky_pass', name: 'Rocky Helmet', desc: 'Rimborso danno ai attaccanti', icon: '🛡️', passive: true },
    { id: 'protective_pads', name: 'Protective Pads', desc: 'Lotta: sopravvivi con 1 PS', icon: '🛡️', passive: true },
    { id: 'spatk_stack', name: 'Sp.Atk Stack', desc: 'Stack Sp.Atk per colpo superefficace', icon: '⚫', passive: true },
    { id: 'rock_sturdy', name: 'Rock Sturdy', desc: 'Roccia: sopravvivi a un KO', icon: '🪨', passive: true },
    { id: 'dragon_fang', name: 'Dragon Fang', desc: '+50% danno Drago', icon: '🐉', passive: true },
    { id: 'dragon_scale', name: 'Dragon Scale', desc: 'Primo crit Drago potenziato', icon: '🐲', passive: true },
    { id: 'metal_alloy', name: 'Metal Alloy', desc: 'Acciaio: bonus difesa', icon: '⚙️', passive: true },
    { id: 'fairy_charm', name: 'Pink Bow', desc: 'Folletto: effetto flinch', icon: '💞', passive: true },
    { id: 'fairy_open', name: 'Fairy Open', desc: 'Attacchi Folletto potenziati', icon: '✨', passive: true },
    { id: 'fight_revive', name: 'Chople Berry', desc: 'Primo KO: rivivi con PS', icon: '🥊', passive: true },
    { id: 'hp_up_orb', name: 'HP Up', desc: 'Bonus PS max per la run', icon: '💚', passive: true },
    { id: 'star_piece', name: 'Star Piece', desc: 'Potenzia mosse stellari', icon: '🌟', passive: true },
    { id: 'comet_shard', name: 'Comet Shard', desc: 'Al pickup: team casuale', icon: '☄️', passive: true },
    { id: 'legend_aegis', name: 'Legend Aegis', desc: 'Leggendari nel team: bonus', icon: '🌟', passive: true },
    { id: 'water_mirror', name: 'Water Mirror', desc: 'Riflette bonus Acqua', icon: '💧', passive: true },
    { id: 'casteliacone', name: 'Casteliacone', desc: 'Ghiaccia nemici al contatto', icon: '🍦', passive: true },
    { id: 'ice_freeze', name: 'Ice Freeze', desc: 'Chance congelamento', icon: '⛄', passive: true },
    { id: 'fire_share', name: 'Heat Rock', desc: 'Fuoco: condivide bonus', icon: '🪨', passive: true },
    { id: 'fire_amp', name: 'Fire Amp', desc: 'Potenzia mosse Fuoco', icon: '🔥', passive: true },
    { id: 'ground_slow', name: 'Soft Sand', desc: 'Terra: rallenta al contatto', icon: '🏜️', passive: true },
    { id: 'poison_pass', name: 'Toxic Plate', desc: 'Avvelena il team nemico', icon: '☠️', passive: true },
    { id: 'poison_armor', name: 'Poison Barb', desc: 'Veleno: bonus difesa', icon: '🍇', passive: true },
    { id: 'poison_stack', name: 'Poison Stack', desc: 'Veleno: stack passivo', icon: '🟣', passive: true },
    { id: 'bug_release', name: 'Insect Plate', desc: 'Coleottero: rilascia potere', icon: '🐞', passive: true },
    { id: 'bug_legacy', name: 'Bug Legacy', desc: 'Coleottero: eredita bonus', icon: '🪲', passive: true },
    { id: 'all_more', name: 'Absorb Orb', desc: 'Piu danno dato e ricevuto', icon: '🔮', passive: true },
    { id: 'all_half', name: 'Guard Orb', desc: 'Meno danno dato e ricevuto', icon: '🛡️', passive: true },
    { id: 'dmg_cap', name: 'Light Clay', desc: 'Cap danno da superefficaci', icon: '🪨', passive: true },
    { id: 'elec_chain', name: 'Magnet Pass', desc: 'Catena effetti Elettro', icon: '🧲', passive: true },
    { id: 'elec_lead', name: 'Battery', desc: 'Elettro guida il team', icon: '🔋', passive: true },
    { id: 'grassy_seed', name: 'Grassy Seed', desc: 'Inizio lotta: +100% HP Erba', icon: '🌱', passive: true },
    { id: 'muscle_band', name: 'Muscle Band', desc: 'Chance boost ATK e Speed', icon: '🦾', passive: true },
    { id: 'power_lens', name: 'Power Lens', desc: 'Bonus su superefficaci', icon: '💪', passive: true },
    { id: 'pure_incense', name: 'Pure Incense', desc: '+10% danno se slot vuoto', icon: '☯️', passive: true },
    { id: 'rock_incense', name: 'Rock Incense', desc: 'Roccia: +50% da stage DEF', icon: '⛰️', passive: true },
    { id: 'smoke_ball', name: 'Smoke Ball', desc: 'Immune confusione/veleno', icon: '💨', passive: true },
    { id: 'smooth_rock', name: 'Smooth Rock', desc: 'Estende effetti campo', icon: '⏳', passive: true },
    { id: 'air_balloon', name: 'Air Balloon', desc: 'Schiva un attacco', icon: '🎈', passive: true },
    { id: 'dread_plate', name: 'Dread Plate', desc: 'Potenzia mosse spaventose', icon: '💀', passive: true },
    { id: 'master_ball_pass', name: 'Master Ball', desc: 'Effetto passivo raro', icon: '🌟', passive: true },
    { id: 'tiny_mushroom', name: 'Tiny Mushroom', desc: 'Spore al posto dell attacco', icon: '🍄', passive: true },
    { id: 'roseli_berry', name: 'Roseli Berry', desc: 'Annulla debuff', icon: '🧚', passive: true },
    { id: 'chilan_berry', name: 'Chilan Berry', desc: 'Riduce danno Normale', icon: '❄️', passive: true },
    { id: 'aspear_berry', name: 'Aspear Berry', desc: 'Cura quando alleato curato', icon: '🍑', passive: true },
    { id: 'rand_nerf', name: 'Grepa Berry', desc: 'Nerf stat nemico al colpo', icon: '🌿', passive: true },
    { id: 'ko_maxhp', name: 'HP Up Orb', desc: 'Bonus PS massimi run', icon: '💚', passive: true },
    { id: 'spell_tag', name: 'Spell Tag', desc: 'Potenzia mosse speciali', icon: '🏷️', passive: true },
    { id: 'lifesteal', name: 'Big Root', desc: 'Cura dal danno inflitto', icon: '🌿', passive: true },
    { id: 'water_def_debuff', name: 'Mystic Water Pass', desc: 'Acqua: debuff difesa nemica', icon: '🔱', passive: true },
    { id: 'ice_refreeze', name: 'Never-Melt Ice', desc: 'Ricongela i nemici', icon: '❄️', passive: true },
    { id: 'ice_shatter', name: 'Ice Shatter', desc: 'Doppio danno su congelati', icon: '🧊', passive: true },
    { id: 'half_twice', name: 'Half Twice', desc: 'Danno dimezzato ma due volte', icon: '↪️', passive: true },
    { id: 'crit_overflow', name: 'Scope Pass', desc: 'Eccesso crit diventa danno', icon: '🔭', passive: true },
    { id: 'flying_dodge', name: 'Feather Pass', desc: 'Volante: chance schivata', icon: '💨', passive: true },
    { id: 'ground_slow_onhit', name: 'Ground Slow', desc: 'Terra: rallenta al colpo', icon: '🟤', passive: true },
    { id: 'poison_onhit', name: 'Poison Touch', desc: 'Avvelena al contatto', icon: '☠️', passive: true },
    { id: 'debuff_mirror', name: 'Mental Herb', desc: 'Riflette debuff al nemico', icon: '🍃', passive: true },
    { id: 'team_upgrade', name: 'Upgrade Disc', desc: 'Potenzia tutto il team', icon: '⬆️', passive: true }
  ];
  const ITEMS_HELD = ITEM_CATALOG.filter(i => !i.passive);
  const ITEMS_PASSIVE = ITEM_CATALOG.filter(i => i.passive);

  function _itemRowHtml(it) {
    const tags = [];
    if (it.passive) tags.push('passivo');
    if (it.usable) tags.push('usabile');
    const tagStr = tags.length ? ' <span class="pkt-item-tag">' + tags.join(', ') + '</span>' : '';
    return '<div class="pkt-item-row">' +
      '<span class="pkt-item-icon">' + (it.icon || '-') + '</span>' +
      '<div class="pkt-item-info"><div class="pkt-item-name">' + it.name + tagStr + '</div>' +
      '<div class="pkt-item-desc">' + it.desc + '</div></div></div>';
  }
  function _itemsListHtml(items) {
    return items.length ? items.map(_itemRowHtml).join('') : '<div class="pkt-hint">Nessun item</div>';
  }
  function _collectLocalStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    const dump = {};
    keys.forEach(k => { if (k != null) dump[k] = localStorage.getItem(k); });
    return dump;
  }
  function _humanSize(str) {
    const b = new Blob([str]).size;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }

  // ============================================================
  // DAILY REWARD — una riscossione al giorno (localStorage)
  // ============================================================
  const DAILY_REWARD_KEY = 'pkt_daily_reward_date';
  const DAILY_REWARDS = [
    { type: 'dollars', amount: 500, label: '500 Pokédollars', icon: '💵' },
    { type: 'dollars', amount: 1000, label: '1.000 Pokédollars', icon: '💵' },
    { type: 'dollars', amount: 2000, label: '2.000 Pokédollars', icon: '💵' },
    { type: 'dollars', amount: 3000, label: '3.000 Pokédollars', icon: '💵' },
    { type: 'egg', eggType: 'shiny', label: 'Uovo Shiny', icon: '🥚' },
    { type: 'egg', eggType: 'legendary', label: 'Uovo Leggendario', icon: '⭐' },
  ];

  function _todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _dailyRewardClaimedToday() {
    return localStorage.getItem(DAILY_REWARD_KEY) === _todayKey();
  }

  function _markDailyRewardClaimed() {
    localStorage.setItem(DAILY_REWARD_KEY, _todayKey());
  }

  function _pickDailyReward() {
    return DAILY_REWARDS[Math.floor(Math.random() * DAILY_REWARDS.length)];
  }

  async function _applyDailyReward(reward) {
    if (reward.type === 'dollars') {
      if (typeof window.addPokedollars !== 'function') throw new Error('addPokedollars non disponibile');
      window.addPokedollars(reward.amount);
      if (typeof window.refreshShopBalance === 'function') window.refreshShopBalance();
      return;
    }
    if (reward.type === 'egg') {
      if (typeof window.hatchEgg !== 'function') throw new Error('hatchEgg non disponibile');
      await window.hatchEgg(reward.eggType);
      return;
    }
    throw new Error('Reward sconosciuta');
  }

  function _rewardPreviewText(reward) {
    if (reward.type === 'dollars') return reward.label;
    return reward.label;
  }

  function _closeDailyRewardModal() {
    const overlay = document.getElementById('pkt-daily-overlay');
    if (overlay) overlay.remove();
  }

  async function _deliverDailyReward(reward) {
    try {
      await _applyDailyReward(reward);
      if (reward.type === 'dollars') _showDailyDeliveryToast('+' + reward.amount + ' Pokédollars!');
      log('Daily reward: ' + reward.label, '#f1c40f');
    } catch (err) {
      log('Daily reward errore: ' + err.message, '#e74c3c');
      _showDailyDeliveryToast('Errore consegna reward', true);
      console.error('[POKE-TOOLKIT] Daily reward:', err);
    }
  }

  function _showDailyDeliveryToast(msg, isError) {
    if (document.getElementById('pkt-daily-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'pkt-daily-toast';
    toast.className = 'pkt-daily-toast' + (isError ? ' pkt-daily-toast-err' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pkt-daily-toast-show'));
    if (!isError && typeof SFX !== 'undefined' && SFX.ITEM) SFX.ITEM();
    setTimeout(() => {
      toast.classList.remove('pkt-daily-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function _showDailyRewardModal() {
    if (_dailyRewardClaimedToday() || document.getElementById('pkt-daily-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pkt-daily-overlay';
    overlay.innerHTML = [
      '<div id="pkt-daily-reward" class="pkt-daily-modal" role="dialog" aria-labelledby="pkt-daily-title">',
      '<div class="pkt-daily-badge">PokeLike Toolkit</div>',
      '<h2 id="pkt-daily-title">Reward Giornaliera</h2>',
      '<p class="pkt-daily-sub">Regalo gratuito dal nostro tool. Una volta al giorno.</p>',
      '<div class="pkt-daily-icon" id="pkt-daily-icon">🎁</div>',
      '<div id="pkt-daily-result" class="pkt-daily-result" hidden>',
      '<div class="pkt-daily-preview-label">La tua reward</div>',
      '<div class="pkt-daily-preview-name" id="pkt-daily-preview-name"></div>',
      '<div class="pkt-daily-preview-hint" id="pkt-daily-preview-hint"></div>',
      '</div>',
      '<button type="button" id="pkt-daily-claim" class="pkt-daily-btn">Riscatta</button>',
      '</div>',
    ].join('');

    if (!document.getElementById('pkt-daily-styles')) {
      const style = document.createElement('style');
      style.id = 'pkt-daily-styles';
      style.textContent = [
        '#pkt-daily-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;',
        'background:rgba(8,4,18,.88);backdrop-filter:blur(3px);font-family:"Press Start 2P",monospace,sans-serif;animation:pktDailyFadeIn .3s ease}',
        '@keyframes pktDailyFadeIn{from{opacity:0}to{opacity:1}}',
        '@keyframes pktDailyPop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}',
        '@keyframes pktDailyBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
        '.pkt-daily-modal{width:min(100%,300px);padding:14px 12px 12px;border-radius:8px;text-align:center;',
        'color:#e0b0ff;background:#100820;border:2px solid #c050ff;box-shadow:0 0 20px #c050ff44;animation:pktDailyPop .35s ease}',
        '.pkt-daily-badge{display:inline-block;margin-bottom:8px;padding:4px 8px;border-radius:4px;',
        'font-size:6px;letter-spacing:.5px;color:#100820;background:#c050ff}',
        '.pkt-daily-modal h2{margin:0 0 6px;font-size:8px;font-weight:400;color:#c050ff;line-height:1.8}',
        '.pkt-daily-sub{margin:0 0 10px;font-size:6px;line-height:1.9;color:#7050aa}',
        '.pkt-daily-icon{font-size:32px;line-height:1;margin:2px 0 10px;animation:pktDailyBounce 1.6s ease-in-out infinite}',
        '.pkt-daily-result{margin:0 0 10px;padding:8px 6px;border-radius:4px;border:1px solid #c050ff33;background:#1a0e2e}',
        '.pkt-daily-preview-label{font-size:6px;color:#9060cc;margin-bottom:6px}',
        '.pkt-daily-preview-name{font-size:8px;color:#e0b0ff;line-height:1.8;margin-bottom:4px}',
        '.pkt-daily-preview-hint{font-size:5px;color:#7050aa;line-height:1.8}',
        '.pkt-daily-btn{display:block;width:100%;margin-top:2px;padding:8px 6px;border:1px solid #c050ff;border-radius:4px;cursor:pointer;',
        'font-family:inherit;font-size:7px;color:#e0b0ff;background:#1e103a}',
        '.pkt-daily-btn:hover:not(:disabled){background:#2e1a50}',
        '.pkt-daily-btn:disabled{opacity:.5;cursor:default}',
        '.pkt-daily-toast{position:fixed;top:16px;left:50%;transform:translate(-50%,-12px);z-index:2147483001;',
        'padding:10px 14px;border-radius:6px;border:2px solid #c050ff;background:#100820;color:#e0b0ff;',
        'font-family:"Press Start 2P",monospace,sans-serif;font-size:7px;line-height:1.8;opacity:0;pointer-events:none;',
        'box-shadow:0 0 16px #c050ff55;transition:opacity .25s ease,transform .25s ease}',
        '.pkt-daily-toast-show{opacity:1;transform:translate(-50%,0)}',
        '.pkt-daily-toast-err{border-color:#ff6666;color:#ffaaaa}',
      ].join('');
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    const claimBtn = document.getElementById('pkt-daily-claim');
    const resultEl = document.getElementById('pkt-daily-result');
    const iconEl = document.getElementById('pkt-daily-icon');
    const previewNameEl = document.getElementById('pkt-daily-preview-name');
    const previewHintEl = document.getElementById('pkt-daily-preview-hint');
    let pendingReward = null;

    claimBtn.addEventListener('click', () => {
      if (claimBtn.disabled) return;

      if (!pendingReward) {
        pendingReward = _pickDailyReward();
        iconEl.textContent = pendingReward.icon;
        previewNameEl.textContent = _rewardPreviewText(pendingReward);
        previewHintEl.textContent = pendingReward.type === 'egg'
          ? 'Chiudi per schiudere l\'uovo con la grafica di gioco.'
          : 'Chiudi per accreditare i Pokédollars.';
        resultEl.hidden = false;
        claimBtn.textContent = 'Ricevi!';
        return;
      }

      const reward = pendingReward;
      claimBtn.disabled = true;
      claimBtn.textContent = '...';
      _markDailyRewardClaimed();
      _closeDailyRewardModal();
      setTimeout(() => { _deliverDailyReward(reward); }, 120);
    });
  }

  function initDailyReward() {
    if (_dailyRewardClaimedToday()) return;
    let attempts = 0;
    const wait = setInterval(() => {
      attempts++;
      if (typeof window.addPokedollars === 'function' && typeof window.hatchEgg === 'function') {
        clearInterval(wait);
        setTimeout(_showDailyRewardModal, 1000);
      } else if (attempts > 80) clearInterval(wait);
    }, 500);
  }

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
    store[_bfGetRoot(speciesId)] = { ...BF_DEFAULT, ...vals };
    _bfSaveStore(store);
  }
  function _refreshSoon(ms) {
    if (ms === undefined) ms = 2500;
    setTimeout(() => location.reload(), ms);
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
  const YT_PLAYLIST_ID = 'PL9sQLK1ZZa9M7lOQB-8w9zii8UOV-ioMz';
  const YT_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=' + YT_PLAYLIST_ID;
  const YT_PLAYLIST_FALLBACK = [
    { videoId: '4gVLygCnzIE', title: 'COME VINCERE HOENN - Pokemon Roguelike Pokelike' },
    { videoId: 'zlExsKT6vB4', title: 'DISTRUGGO la SUPER4 GHOST - Pokemon Roguelike Pokelike' },
    { videoId: 'JHglZOwB1zY', title: 'NUOVA REGIONE! - v2.1 UPDATE | Pokemon Roguelike Pokelike' },
    { videoId: '_rr0dOVwr74', title: 'Ho ROTTO la CHALLENGE - Pokemon Roguelike Pokelike' },
    { videoId: 'igStBz6WbbQ', title: 'COMBO DEVASTANTE - Pokemon Roguelike Pokelike' },
    { videoId: 'IjrFJztMtCU', title: 'Questo GIOCO è una DROGA! 2.0 - Pokemon Roguelike Pokelike' },
    { videoId: 'L2x_E3l3YNI', title: 'ORA cambia TUTTO! - v2.0 UPDATE | Pokemon Roguelike Pokelike' },
    { videoId: 'oCm9UHNENIQ', title: 'NUOVI POKEMON?! | Pokemon Roguelike Pokelike' },
    { videoId: '6USEm_JPlmQ', title: 'VINCO SENZA CENTRI POKEMON?! - Achievement | Pokemon Roguelike Pokelike' },
    { videoId: 'l8hRCkgaolM', title: 'COME BATTERE UNIMA! - Torre Pokemon | Pokemon Roguelike Pokelike' },
    { videoId: 'rioCqSn2cCo', title: 'DISTRUGGO CAMILLA! - Torre Pokemon Sinnoh | Pokemon Roguelike Pokelike' },
    { videoId: 'XU6hEfzWAHo', title: 'GIOCHIAMO IN NUZLOCKE! - Kanto & Johto | Pokemon Roguelike Pokelike' },
    { videoId: 'FerauBIml9g', title: 'ARCEUS IMBATTIBILE! - Torre Pokemon Sinnoh | Pokemon Roguelike Pokelike' },
    { videoId: 'R-eRBg0FNRg', title: 'DISTRUGGO LA TORRE! - Il POKEMON Finale | Pokemon Roguelike Pokelike' },
    { videoId: 'Ms7oX6DysPM', title: 'HO ROTTO IL GIOCO! - La COMBO Definitiva | Pokemon Roguelike Pokelike' },
  ];
  let _playlistInit = false;
  let _playlistLive = false;

  function _fetchText(url) {
    return fetch(url).then(r => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))));
  }

  function _parseYoutubePlaylistXml(text) {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    return Array.from(xml.querySelectorAll('entry')).map(entry => {
      const idEl = entry.getElementsByTagNameNS('http://www.youtube.com/xml/schemas/2015', 'videoId')[0];
      const videoId = idEl ? idEl.textContent : (entry.querySelector('link')?.getAttribute('href') || '').split('v=')[1]?.split('&')[0];
      const title = (entry.querySelector('title')?.textContent || 'Video').replace(/&amp;/g, '&');
      return { videoId, title };
    }).filter(v => v.videoId);
  }

  function _renderPlaylistItems(container, items) {
    container.innerHTML = items.map(v =>
      '<a class="pkt-playlist-item" href="https://www.youtube.com/watch?v=' + v.videoId + '&list=' + YT_PLAYLIST_ID + '" target="_blank" rel="noopener" title="' + v.title.replace(/"/g, '&quot;') + '">' +
      '<img src="https://i.ytimg.com/vi/' + v.videoId + '/mqdefault.jpg" alt="" loading="lazy">' +
      '<span class="pkt-playlist-item-title">' + v.title + '</span></a>'
    ).join('');
  }

  async function loadYoutubePlaylist(container) {
    if (!container) return;
    if (!_playlistInit) {
      _renderPlaylistItems(container, YT_PLAYLIST_FALLBACK);
      _playlistInit = true;
    }
    if (_playlistLive) return;
    try {
      const text = await _fetchText('https://www.youtube.com/feeds/videos.xml?playlist_id=' + YT_PLAYLIST_ID);
      const items = _parseYoutubePlaylistXml(text);
      if (!items.length) throw new Error('Playlist vuota');
      _renderPlaylistItems(container, items);
      _playlistLive = true;
    } catch (err) {
      console.warn('[POKE-TOOLKIT] Playlist live:', err);
    }
  }

  function createPanel() {
    if (!document.body) { setTimeout(createPanel, 300); return; }
    const legacy = document.getElementById('poke-audio-panel');
    if (legacy) legacy.remove();
    if (document.getElementById('pkt-panel')) return;
    const bfSlidersHtml = BF_STATS.map(s =>
      '<div class="pkt-row" style="margin-bottom:4px"><span class="pkt-stat-label">' +
      (BF_LABELS[s] || s) +
      '</span><input type="range" id="bf-stat-' + s + '" min="0" max="10" value="0" class="pkt-slider" style="flex:1">' +
      '<span id="bf-val-' + s + '" class="pkt-stat-val">0</span></div>'
    ).join('');
    const SVG = {
      toggle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c050ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      audio: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      dex: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      starter: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      ev: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      items: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      save: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      playlist: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none"><mask id="pkt-yt-mask" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="2" y="4" width="20" height="16"><path d="M12 5C21 5 21 5 21 12C21 19 21 19 12 19C3 19 3 19 3 12C3 5 3 5 12 5Z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 8.5L16 12L10 15.5V8.5Z" fill="black"/></mask><g mask="url(#pkt-yt-mask)"><path d="M0 0H24V24H0V0Z" fill="currentColor"/></g></svg>',
      kofi: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
      twitch: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M11.6397 5.93H13.0697V10.21H11.6397M15.5697 5.93H16.9997V10.21H15.5697M6.99969 2L3.42969 5.57V18.43H7.70969V22L11.2897 18.43H14.1397L20.5697 12V2M19.1397 11.29L16.2897 14.14H13.4297L10.9297 16.64V14.14H7.70969V3.43H19.1397V11.29Z" fill="currentColor"/></svg>',
    };
    const panel = document.createElement('div');
    panel.id = 'pkt-panel';
    panel.innerHTML = [
      '<div id="pkt-toggle" title="PokeLike Toolkit">' + SVG.toggle + '</div>',
      '<div id="pkt-body" style="display:none">',
      '<div class="pkt-header">PokeLike Toolkit v6.3.2</div>',
      '<div class="pkt-tab-panels">',
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
      '<div class="pkt-tab-head"><div class="pkt-tab-title">StarterPC</div><div class="pkt-tab-desc">Inserisci la forma esatta (es. Butterfree, non Caterpie). Leggendari: supporto limitato.</div></div>',
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
      '<div class="pkt-tab-panel" data-panel="items">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">Catalogo Item</div>',
      '<div class="pkt-tab-desc">Riferimento item tenuti e passivi mappa.</div></div>',
      '<div class="pkt-section"><div class="pkt-label">Tenuti (' + ITEMS_HELD.length + ')</div>',
      '<div class="pkt-item-list pkt-item-list-held">' + _itemsListHtml(ITEMS_HELD) + '</div></div>',
      '<div class="pkt-section"><div class="pkt-label">Passivi (' + ITEMS_PASSIVE.length + ')</div>',
      '<div class="pkt-item-list pkt-item-list-passive">' + _itemsListHtml(ITEMS_PASSIVE) + '</div></div></div>',
      '<div class="pkt-tab-panel" data-panel="save">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">Backup Save</div>',
      '<div class="pkt-tab-desc">Esporta o importa tutto il localStorage di pokelike.xyz.</div></div>',
      '<div class="pkt-section"><button id="sv-export" class="pkt-btn pkt-full">Esporta tutto (file)</button>',
      '<button id="sv-copy" class="pkt-btn pkt-full" style="margin-top:4px">Copia negli appunti</button>',
      '<button id="sv-import" class="pkt-btn pkt-full" style="margin-top:4px">Importa da file</button></div>',
      '<div class="pkt-section"><div id="sv-status" class="pkt-status">-</div></div></div>',
      '<div class="pkt-tab-panel" data-panel="playlist">',
      '<div class="pkt-tab-head"><div class="pkt-tab-title">Playlist Pokémon</div>',
      '<div class="pkt-tab-desc">Video Pokelike AlepreRun, clicca per aprire su YouTube.</div></div>',
      '<div id="pkt-playlist-scroll" class="pkt-playlist-scroll"></div>',
      '<a href="' + YT_PLAYLIST_URL + '" target="_blank" rel="noopener" class="pkt-btn pkt-full" style="margin-top:6px;display:block;text-align:center;text-decoration:none">Apri playlist</a>',
      '</div>',
      '</div>',
      '<div class="pkt-tabs">',
      '<button class="pkt-tab active" data-tab="audio" title="Audio">' + SVG.audio + '</button>',
      '<button class="pkt-tab" data-tab="dex" title="Pokedex">' + SVG.dex + '</button>',
      '<button class="pkt-tab" data-tab="starter" title="Starter PC">' + SVG.starter + '</button>',
      '<button class="pkt-tab" data-tab="ev" title="EV / Buff">' + SVG.ev + '</button>',
      '<button class="pkt-tab" data-tab="items" title="Item">' + SVG.items + '</button>',
      '<button class="pkt-tab" data-tab="save" title="Save">' + SVG.save + '</button>',
      '<button class="pkt-tab" data-tab="playlist" title="Playlist">' + SVG.playlist + '</button>',
      '</div>',
      '<div class="pkt-links">',
      '<a href="https://ko-fi.com/erry96" target="_blank" rel="noopener" class="pkt-link pkt-link-kofi" title="Ko-fi">' + SVG.kofi + '<span>Ko-fi</span></a>',
      '<a href="https://www.twitch.tv/alepre98" target="_blank" rel="noopener" class="pkt-link pkt-link-twitch" title="Twitch — Alepre98">' + SVG.twitch + '<span>Twitch</span></a>',
      '</div>',
      '</div></div>',
    ].join('');
    const style = document.createElement('style');
    style.textContent = '#pkt-panel{position:fixed;bottom:12px;left:12px;z-index:99999;font-family:"Press Start 2P",monospace,sans-serif;font-size:9px}#pkt-toggle{width:36px;height:36px;background:#1a0e2e;border:2px solid #c050ff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 8px #c050ff44;transition:transform .2s;user-select:none}#pkt-toggle:hover{transform:scale(1.1)}#pkt-body{position:absolute;bottom:44px;left:0;background:#100820;border:2px solid #c050ff;border-radius:8px;padding:12px 14px;min-width:260px;max-width:300px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 0 16px #c050ff33;color:#e0b0ff}.pkt-header{font-size:7px;letter-spacing:1px;color:#c050ff;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #c050ff33;text-align:center}.pkt-links{display:flex;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #c050ff33;flex-shrink:0}.pkt-link{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 6px;border-radius:4px;font-size:6px;text-decoration:none;font-family:inherit;transition:background .15s}.pkt-link-kofi{background:#1e103a;border:1px solid #ff5e5b44;color:#ff5e5b}.pkt-link-kofi:hover{background:#2a1428;color:#ff8a88}.pkt-link-twitch{background:#c050ff22;border:1px solid #c050ff;color:#e0b0ff}.pkt-link-twitch:hover{background:#c050ff44}.pkt-tab-panels{flex:1;overflow-y:auto;min-height:0;margin-bottom:0}.pkt-tabs{display:flex;flex-wrap:nowrap;gap:3px;border-top:1px solid #c050ff33;padding-top:6px;margin-top:8px;flex-shrink:0}.pkt-tab{flex:1 1 0;min-width:0;background:#1e103a;border:1px solid #9060cc;color:#9060cc;font-family:inherit;padding:5px 1px;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center}.pkt-tab svg{display:block}.pkt-tab:hover{background:#2e1a50}.pkt-tab.active{background:#c050ff22;border-color:#c050ff;color:#e0b0ff}.pkt-tab-panel{display:none}.pkt-tab-panel.active{display:block}.pkt-tab-head{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #c050ff22}.pkt-tab-title{font-size:8px;color:#c050ff;margin-bottom:4px}.pkt-tab-desc{font-size:6px;color:#7050aa;line-height:1.8}.pkt-section{margin-bottom:8px}.pkt-label{font-size:7px;color:#9060cc;margin-bottom:4px}.pkt-label-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;color:#c8a0ff;font-size:7px}.pkt-hint{font-size:6px;color:#7050aa;line-height:1.7}.pkt-row{display:flex;gap:6px;align-items:center}.pkt-check-row{display:flex;gap:6px;align-items:center;cursor:pointer;font-size:7px;color:#e0b0ff;margin-bottom:3px}.pkt-check-row.pkt-main{font-size:8px;color:#c050ff;margin-bottom:5px}.pkt-input{flex:1;min-width:0;background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 6px;border-radius:3px}.pkt-select{width:100%;background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 6px;border-radius:3px;cursor:pointer}.pkt-btn{background:#1e103a;border:1px solid #c050ff;color:#e0b0ff;font-family:inherit;font-size:7px;padding:4px 8px;border-radius:3px;cursor:pointer;white-space:nowrap}.pkt-btn:hover{background:#2e1a50}.pkt-btn.pkt-full{width:100%;display:block}.pkt-btn-red{border-color:#ff4444;color:#ff9999}.pkt-btn-red:hover{background:#3a0a0a}.pkt-status{font-size:7px;color:#a080d0;min-height:12px;word-break:break-all}.pkt-progress{font-size:9px;color:#c050ff;margin-top:3px;font-weight:bold}.pkt-slider{width:100%;accent-color:#c050ff;cursor:pointer}.pkt-stat-label{width:28px;font-size:6px;color:#9060cc}.pkt-stat-val{width:14px;text-align:right;font-size:7px}.pkt-footer{margin-top:6px;border-top:1px solid #c050ff33;padding-top:6px}.spc-ind-list{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;max-height:72px;overflow-y:auto}.spc-ind-tag{display:inline-flex;align-items:center;gap:3px;background:#1e103a;border:1px solid #9060cc;border-radius:3px;padding:2px 4px;font-size:6px;color:#c8a0ff}.spc-ind-rm{background:none;border:none;color:#ff8888;cursor:pointer;font-size:8px;padding:0 1px;line-height:1}.spc-ind-rm:hover{color:#ff4444}.pkt-item-list-held{max-height:110px;overflow-y:auto;border:1px solid #c050ff22;border-radius:4px;padding:4px 6px}.pkt-item-list-passive{max-height:150px;overflow-y:auto;border:1px solid #c050ff22;border-radius:4px;padding:4px 6px}.pkt-item-row{display:flex;gap:6px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #1a1030}.pkt-item-row:last-child{border-bottom:none}.pkt-item-icon{font-size:10px;line-height:1.4;flex-shrink:0}.pkt-item-info{flex:1;min-width:0}.pkt-item-name{font-size:6px;color:#c8a0ff;line-height:1.6}.pkt-item-desc{font-size:5px;color:#7050aa;line-height:1.7;margin-top:1px}.pkt-item-tag{font-size:5px;color:#c050ff}.pkt-playlist-scroll{display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:200px;padding:2px 0;scrollbar-width:thin;scrollbar-color:#c050ff44 transparent}.pkt-playlist-scroll::-webkit-scrollbar{width:4px}.pkt-playlist-scroll::-webkit-scrollbar-thumb{background:#c050ff55;border-radius:2px}.pkt-playlist-item{display:flex;gap:6px;align-items:center;text-decoration:none;color:inherit;padding:3px;border-radius:3px}.pkt-playlist-item:hover{background:#1e103a}.pkt-playlist-item img{flex-shrink:0;width:72px;height:41px;object-fit:cover;border:1px solid #c050ff44;border-radius:3px;background:#1e103a}.pkt-playlist-item:hover img{border-color:#c050ff}.pkt-playlist-item-title{flex:1;min-width:0;font-size:5px;color:#9060cc;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}';
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
        if (activeTab === 'playlist') loadYoutubePlaylist(document.getElementById('pkt-playlist-scroll'));
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
    document.getElementById('spc-enabled').addEventListener('change', e => {
      TOOLS.spcEnabled = e.target.checked;
      saveTools();
      _spcSyncToStorage();
      ensureSpcPatches();
    });
    document.getElementById('spc-shiny-chk').addEventListener('change', e => {
      TOOLS.spcShiny = e.target.checked;
      saveTools();
      _spcSyncToStorage();
    });
    spcClearBtn.addEventListener('click', () => {
      spcClearIndividual();
      renderSpcCurrent();
      spcIndStatusEl.textContent = 'Pokemon rimosso — ricarico...';
      _refreshSoon(1500);
    });
    document.getElementById('spc-add').addEventListener('click', async () => {
      const input = document.getElementById('spc-input');
      spcIndStatusEl.textContent = 'Ricerca...';
      const resolved = await _resolvePokeId(input.value);
      if (!resolved.ok) { spcIndStatusEl.textContent = resolved.msg; return; }
      const res = spcSetIndividual(resolved.id);
      if (!res.ok) { spcIndStatusEl.textContent = res.msg; return; }
      document.getElementById('spc-enabled').checked = true;
      const label = resolved.name || ('#' + resolved.id);
      _spcSyncToStorage();
      ensureSpcPatches();
      spcIndStatusEl.textContent = label + ' aggiunto — ricarico...';
      input.value = '';
      await renderSpcCurrent();
      _refreshSoon(1500);
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
    const svStatusEl = document.getElementById('sv-status');
    document.getElementById('sv-export').addEventListener('click', () => {
      try {
        const dump = _collectLocalStorage();
        const n = Object.keys(dump).length;
        const json = JSON.stringify(dump, null, 2);
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pokelike-save-' + Date.now() + '.json';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
        svStatusEl.textContent = 'Esportate ' + n + ' chiavi (' + _humanSize(json) + ')';
      } catch (e) {
        svStatusEl.textContent = 'Export fallito: ' + e.message;
      }
    });
    document.getElementById('sv-copy').addEventListener('click', async () => {
      const dump = _collectLocalStorage();
      const n = Object.keys(dump).length;
      const json = JSON.stringify(dump, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        svStatusEl.textContent = 'Copiate ' + n + ' chiavi (' + _humanSize(json) + ')';
      } catch {
        svStatusEl.textContent = 'Clipboard non disponibile - usa Esporta file';
      }
    });
    document.getElementById('sv-import').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json';
      inp.onchange = e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = ev => {
          try {
            const data = JSON.parse(ev.target.result);
            Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
            svStatusEl.textContent = 'Importate ' + Object.keys(data).length + ' chiavi - ricarica la pagina';
            _refreshSoon(3000);
          } catch (err) {
            svStatusEl.textContent = 'Import fallito: ' + err.message;
          }
        };
        r.readAsText(file);
      };
      inp.click();
    });
  }

  function log(msg, color) {
    if (color === undefined) color = '#9b59b6';
    console.log('%c[POKE-TOOLKIT] ' + msg, 'background:#1a0a2e;color:' + color + ';font-weight:bold;padding:2px 5px;border:1px solid ' + color + ';');
  }

  function init() {
    try {
    createPanel();
    log('PokeLike Toolkit v6.3.2 avviato', '#2ecc71');
    initDailyReward();
    watchMaintenanceBypass();
    injectInstantScreenCSS();
    patchGameTransitions();
    watchGameBgm();
    stopBgm();
    ensureSpcPatches();
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

  function boot() {
    try { init(); } catch (err) { console.error('[POKE-TOOLKIT] Errore boot:', err); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(() => {
    if (!document.getElementById('pkt-panel')) boot();
  }, 2000);

})();
