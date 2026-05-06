// ==UserScript==
// @name         PokeLike Audio Engine v5.0
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  SFX + musiche di sottofondo sintetiche per ogni evento del gioco, pannello volume, contatore punti run
// @author       GitHub Copilot
// @match        https://pokelike.xyz/*
// @grant        none
// @run-at       document-idle
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
    battle: `${CDN}/audio/bgm/battle.mp3`,
    boss:   `${CDN}/audio/bgm/boss.mp3`,
    elite:  `${CDN}/audio/bgm/elite.mp3`,
    win:    `${CDN}/audio/bgm/win.mp3`,
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
    sfxVolume: 0.18,
    bgmVolume: 0.06,
    sfxEnabled: true,
    bgmEnabled: true,
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

  // ============================================================
  // SINTESI SFX
  // ============================================================
  function playTone(freq, type, duration, volume = 0.1, delay = 0) {
    if (!SETTINGS.sfxEnabled) return;
    const ctx = getCtx();
    const vol = volume * SETTINGS.sfxVolume / 0.18;
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

  function playMp3Sfx(url, volume = 1.0) {
    if (!SETTINGS.sfxEnabled || !url) return false;
    const ctx = getCtx();
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = decoded;
        gain.gain.setValueAtTime(volume * SETTINGS.sfxVolume / 0.18, ctx.currentTime);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      })
      .catch(() => {});
    return true;
  }

  // Ogni SFX con fallback sintesi
  const SFX = {
    WILD: () => {
      if (playMp3Sfx(MP3_SFX.wild)) return;
      playTone(330, 'sine', 0.12);
      playTone(262, 'sine', 0.25, 0.1, 0.12);
      playTone(440, 'sawtooth', 0.3, 0.12, 0.3);
    },
    TRAINER: () => {
      if (playMp3Sfx(MP3_SFX.trainer)) return;
      [523, 659, 523, 784].forEach((f, i) => playTone(f, 'square', 0.1, 0.12, i * 0.11));
    },
    GYM: () => {
      if (playMp3Sfx(MP3_SFX.gym)) return;
      [330, 415, 494, 659, 784].forEach((f, i) => playTone(f, 'sawtooth', 0.15, 0.14, i * 0.1));
    },
    CATCH: () => {
      if (playMp3Sfx(MP3_SFX.catch)) return;
      playTone(880, 'sine', 0.08);
      playTone(987, 'sine', 0.08, 0.1, 0.1);
      playTone(1046, 'sine', 0.12, 0.1, 0.2);
    },
    ITEM: () => {
      if (playMp3Sfx(MP3_SFX.item)) return;
      [1046, 1318, 1568].forEach((f, i) => playTone(f, 'sine', 0.15, 0.12, i * 0.08));
    },
    HEAL: () => {
      if (playMp3Sfx(MP3_SFX.heal)) return;
      [523, 659, 784, 1046].forEach((f, i) => playTone(f, 'triangle', 0.35, 0.12, i * 0.1));
    },
    TRADE: () => {
      if (playMp3Sfx(MP3_SFX.trade)) return;
      playTone(440, 'sine', 0.2);
      playTone(550, 'sine', 0.2, 0.1, 0.2);
      playTone(660, 'sine', 0.3, 0.12, 0.4);
    },
    SHINY: () => {
      if (playMp3Sfx(MP3_SFX.shiny)) return;
      // Effetto stelle brillanti
      [1568, 1760, 2093, 2637].forEach((f, i) => {
        playTone(f, 'sine', 0.1, 0.13, i * 0.07);
        playTone(f * 0.5, 'triangle', 0.2, 0.08, i * 0.07 + 0.05);
      });
    },
    LEGENDARY: () => {
      if (playMp3Sfx(MP3_SFX.legendary)) return;
      // Fanfara drammatica
      [196, 247, 330, 392, 494].forEach((f, i) => playTone(f, 'sawtooth', 0.4, 0.13, i * 0.12));
    },
    BADGE: () => {
      if (playMp3Sfx(MP3_SFX.badge)) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => playTone(f, 'triangle', 0.3, 0.13, i * 0.1));
    },
    LEVELUP: () => {
      if (playMp3Sfx(MP3_SFX.levelup)) return;
      [330, 415, 523].forEach((f, i) => playTone(f, 'sine', 0.15, 0.1, i * 0.1));
    },
    FAINT: () => {
      if (playMp3Sfx(MP3_SFX.faint)) return;
      [330, 262, 196, 147].forEach((f, i) => playTone(f, 'sawtooth', 0.25, 0.1, i * 0.12));
    },
    GAMEOVER: () => {
      if (playMp3Sfx(MP3_SFX.gameover)) return;
      [262, 247, 220, 196, 175, 165].forEach((f, i) => playTone(f, 'triangle', 0.4, 0.13, i * 0.15));
    },
    VICTORY: () => {
      if (playMp3Sfx(MP3_SFX.victory)) return;
      const melody = [523, 523, 523, 523, 415, 466, 523];
      melody.forEach((f, i) => playTone(f, 'square', 0.12, 0.13, i * 0.15));
    },
    SELECT: () => {
      if (playMp3Sfx(MP3_SFX.select)) return;
      playTone(880, 'sine', 0.1);
      playTone(1100, 'sine', 0.15, 0.12, 0.1);
    },
    CLICK: () => {
      if (playMp3Sfx(MP3_SFX.click)) return;
      playTone(1200, 'sine', 0.04, 0.08);
    },
  };

  // ============================================================
  // BGM (sintesi loop con oscillatori)
  // ============================================================
  let bgmNodes = null;
  let bgmAudioEl = null;
  let currentBgm = null;

  // Pattern melodici: array di [freq, durata] in secondi
  const BGM_PATTERNS = {
    map: [
      [330, 0.25], [392, 0.25], [440, 0.25], [494, 0.5],
      [440, 0.25], [392, 0.25], [349, 0.25], [330, 0.5],
      [294, 0.25], [330, 0.25], [392, 0.25], [440, 0.5],
      [494, 0.25], [440, 0.5], [0, 0.25],
    ],
    battle: [
      [440, 0.15], [494, 0.15], [523, 0.15], [494, 0.15],
      [440, 0.15], [415, 0.3], [392, 0.15], [440, 0.15],
      [494, 0.15], [523, 0.3], [587, 0.15], [659, 0.3],
      [587, 0.15], [523, 0.15], [494, 0.15], [440, 0.3],
    ],
    boss: [
      [220, 0.2], [247, 0.1], [262, 0.2], [294, 0.1],
      [330, 0.3], [294, 0.1], [262, 0.1], [247, 0.1],
      [220, 0.2], [196, 0.1], [220, 0.4], [0, 0.2],
      [330, 0.2], [349, 0.1], [392, 0.3], [440, 0.4],
    ],
    elite: [
      [262, 0.15], [294, 0.15], [330, 0.3], [392, 0.15],
      [440, 0.3], [392, 0.15], [349, 0.15], [330, 0.15],
      [294, 0.3], [262, 0.15], [220, 0.3], [196, 0.15],
      [220, 0.5], [0, 0.25],
    ],
    win: [
      [523, 0.2], [659, 0.2], [784, 0.4],
      [523, 0.15], [659, 0.15], [784, 0.15], [1046, 0.5],
    ],
  };

  function stopBgm() {
    if (bgmAudioEl) {
      bgmAudioEl.pause();
      bgmAudioEl.src = '';
      bgmAudioEl = null;
    }
    if (bgmNodes) {
      try { bgmNodes.forEach(n => n.stop && n.stop()); } catch {}
      bgmNodes = null;
    }
    currentBgm = null;
  }

  function playMp3Bgm(url) {
    if (!url) return false;
    stopBgm();
    bgmAudioEl = new Audio(url);
    bgmAudioEl.loop = true;
    bgmAudioEl.volume = SETTINGS.bgmVolume;
    bgmAudioEl.play().catch(() => {});
    return true;
  }

  function playBgmSynth(name) {
    const pattern = BGM_PATTERNS[name];
    if (!pattern) return;
    const ctx = getCtx();
    const loopDuration = pattern.reduce((s, [, d]) => s + d, 0);

    let cancelled = false;
    const nodes = [];
    bgmNodes = nodes;

    function scheduleLoop(startTime) {
      if (cancelled) return;
      let t = startTime;
      pattern.forEach(([freq, dur]) => {
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(SETTINGS.bgmVolume * 0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + dur);
          nodes.push(osc);
        }
        t += dur;
      });
      // Riprogramma il loop prima che finisca
      const loopTimeout = setTimeout(() => {
        if (!cancelled && bgmNodes === nodes) scheduleLoop(ctx.currentTime);
      }, (loopDuration - 0.1) * 1000);
      nodes._loopTimeout = loopTimeout;
    }

    scheduleLoop(ctx.currentTime);
    nodes._cancel = () => { cancelled = true; clearTimeout(nodes._loopTimeout); };
  }

  function playBgm(name) {
    if (!SETTINGS.bgmEnabled) return;
    if (currentBgm === name) return;
    stopBgm();
    currentBgm = name;
    const url = MP3_BGM[name];
    if (url && playMp3Bgm(url)) return;
    playBgmSynth(name);
  }

  function updateBgmVolume() {
    if (bgmAudioEl) bgmAudioEl.volume = SETTINGS.bgmVolume;
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

    // Aggiorna BGM
    if (screenId === 'map-screen') {
      playBgm('map');
    } else if (screenId === 'battle-screen') {
      const title = document.getElementById('battle-title')?.textContent || '';
      if (title.includes('Gym') || title.includes('Elite') || title.includes('Champion') ||
          title.includes('Big Boss') || title.includes('Final Boss')) {
        if (title.includes('Elite') || title.includes('Champion') || title.includes('Final Boss')) {
          playBgm('elite');
        } else {
          playBgm('boss');
        }
      } else {
        playBgm('battle');
      }
    } else if (screenId === 'win-screen') {
      playBgm('win');
    } else if (screenId === 'title-screen' || screenId === 'gameover-screen') {
      stopBgm();
    }

    // SFX per evento schermata
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

    if (screenId === 'catch-screen') SFX.CATCH();
    if (screenId === 'item-screen') SFX.ITEM();
    if (screenId === 'shiny-screen') {
      const content = document.getElementById('shiny-content')?.textContent || '';
      if (content.includes('Shiny')) SFX.SHINY();
      else SFX.TRADE(); // schermata trade usa shiny-screen
    }
    if (screenId === 'trade-screen') SFX.TRADE();
    if (screenId === 'badge-screen') SFX.BADGE();
    if (screenId === 'win-screen') SFX.VICTORY();
    if (screenId === 'stat-buff-screen') SFX.SELECT();

    // Game over
    if (prev === 'battle-screen' && screenId === 'title-screen') {
      // Game over se torniamo al titolo dopo una battaglia
      // Il game over mostra un toast prima di andare al titolo
    }
  }

  // ============================================================
  // OBSERVER PER SCHERMATE (classe 'active')
  // ============================================================
  function initScreenObserver() {
    const screens = document.querySelectorAll('.screen');
    if (screens.length === 0) {
      setTimeout(initScreenObserver, 500);
      return;
    }

    const obs = new MutationObserver(() => {
      const active = document.querySelector('.screen.active');
      if (active) onScreenChange(active.id);
    });

    screens.forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    log('Observer schermate avviato (' + screens.length + ' schermate trovate)');

    // Stato iniziale
    const activeNow = document.querySelector('.screen.active');
    if (activeNow) onScreenChange(activeNow.id);
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
          const cls = node.className || '';
          // Level up animation
          if (cls.includes('levelup') || node.textContent?.includes('grew to')) {
            SFX.LEVELUP();
          }
          // Faint
          if (cls.includes('fainted') || node.textContent?.includes('fainted')) {
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
          const cls = node.className || '';
          const text = node.textContent || '';

          if (cls.includes('levelup-toast') || cls.includes('level-up')) {
            SFX.LEVELUP();
          }
          if (cls.includes('item-found-toast')) {
            SFX.ITEM();
          }
          if (cls.includes('achievement-toast') || cls.includes('ach-toast')) {
            SFX.BADGE();
          }
          if (text.includes('healed') || text.includes('pokecenter') || cls.includes('pokecenter')) {
            SFX.HEAL();
          }
          if (text.includes('fainted')) {
            SFX.FAINT();
          }
          if (cls.includes('bug-levelup') || cls.includes('map-notification')) {
            if (text.includes('grew to') || text.includes('leveled')) SFX.LEVELUP();
          }
          if (text.includes('fully healed')) {
            SFX.HEAL();
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Click su carte pokémon nello starter select → suona SELECT
  function initClickSounds() {
    document.addEventListener('click', (e) => {
      getCtx(); // risveglia il contesto audio al primo click

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

  // ============================================================
  // CONTATORE PUNTI / STATISTICHE RUN
  // ============================================================
  const RUN_STATS = {
    battles: 0,
    catches: 0,
    itemsFound: 0,
    badges: 0,
    levelUps: 0,
    shinyFound: 0,
    tradesCompleted: 0,
    pokecenterUsed: 0,
    faintsPlayer: 0,
    startTime: Date.now(),
    // Punteggio calcolato
    score: 0,
  };

  // Pesi per il punteggio
  const SCORE_WEIGHTS = {
    battles:        10,
    catches:        25,
    itemsFound:     15,
    badges:        100,
    levelUps:        5,
    shinyFound:    200,
    tradesCompleted: 20,
    pokecenterUsed:  -5, // penalità
    faintsPlayer:   -10, // penalità
  };

  function calcScore() {
    let s = 0;
    for (const [k, w] of Object.entries(SCORE_WEIGHTS)) {
      s += (RUN_STATS[k] || 0) * w;
    }
    RUN_STATS.score = Math.max(0, s);
    return RUN_STATS.score;
  }

  // Hook sulla schermata per tracciare eventi
  function trackScreenEvent(screenId) {
    if (screenId === 'battle-screen') RUN_STATS.battles++;
    if (screenId === 'catch-screen') RUN_STATS.catches++;
    if (screenId === 'item-screen') RUN_STATS.itemsFound++;
    if (screenId === 'badge-screen') RUN_STATS.badges++;
    if (screenId === 'trade-screen') RUN_STATS.tradesCompleted++;
    if (screenId === 'shiny-screen') {
      const c = document.getElementById('shiny-content')?.textContent || '';
      if (c.includes('Shiny')) RUN_STATS.shinyFound++;
    }
    updateStatsPanel();
  }

  // Traccia eventi toast
  function trackToastEvent(text, cls) {
    if (text.includes('fully healed') || text.includes('healed!')) RUN_STATS.pokecenterUsed++;
    if (text.includes('grew to') || text.includes('leveled')) RUN_STATS.levelUps++;
    if (text.includes('fainted') && cls.includes('player')) RUN_STATS.faintsPlayer++;
    updateStatsPanel();
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  // ============================================================
  // PANNELLO UI (volume + stats)
  // ============================================================
  let panelVisible = false;
  let statsInterval = null;

  function createPanel() {
    const existing = document.getElementById('poke-audio-panel');
    if (existing) return;

    const panel = document.createElement('div');
    panel.id = 'poke-audio-panel';
    panel.innerHTML = `
      <div id="poke-audio-toggle" title="PokeLike Audio Engine">🎵</div>
      <div id="poke-audio-body" style="display:none">
        <div class="pau-title">🎮 Audio Engine v5</div>
        <div class="pau-section">
          <div class="pau-label">🔊 SFX
            <input type="checkbox" id="pau-sfx-toggle" ${SETTINGS.sfxEnabled ? 'checked' : ''}>
          </div>
          <input type="range" id="pau-sfx-vol" min="0" max="1" step="0.01"
            value="${SETTINGS.sfxVolume}" class="pau-slider">
        </div>
        <div class="pau-section">
          <div class="pau-label">🎵 BGM
            <input type="checkbox" id="pau-bgm-toggle" ${SETTINGS.bgmEnabled ? 'checked' : ''}>
          </div>
          <input type="range" id="pau-bgm-vol" min="0" max="0.3" step="0.005"
            value="${SETTINGS.bgmVolume}" class="pau-slider">
        </div>
        <div class="pau-section" id="pau-stats">
          <div class="pau-stats-title">📊 Stats Run</div>
          <div id="pau-stats-body"></div>
        </div>
        <div class="pau-footer">
          <button id="pau-reset-stats" class="pau-btn">Reset Stats</button>
          <button id="pau-test-sfx" class="pau-btn">Test SFX</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #poke-audio-panel {
        position: fixed;
        bottom: 12px;
        left: 12px;
        z-index: 99999;
        font-family: "Press Start 2P", monospace, sans-serif;
        font-size: 9px;
      }
      #poke-audio-toggle {
        width: 36px;
        height: 36px;
        background: #1a0a2e;
        border: 2px solid #7a4af0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 0 8px #7a4af066;
        transition: transform 0.2s;
        user-select: none;
      }
      #poke-audio-toggle:hover { transform: scale(1.1); }
      #poke-audio-body {
        position: absolute;
        bottom: 44px;
        left: 0;
        background: #1a0a2e;
        border: 2px solid #7a4af0;
        border-radius: 8px;
        padding: 10px 12px;
        min-width: 200px;
        box-shadow: 0 0 16px #7a4af044;
        color: #e0d0ff;
      }
      .pau-title {
        color: #b090ff;
        margin-bottom: 8px;
        font-size: 8px;
        letter-spacing: 1px;
        border-bottom: 1px solid #7a4af044;
        padding-bottom: 4px;
      }
      .pau-section { margin-bottom: 8px; }
      .pau-label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 3px;
        color: #c8a8ff;
      }
      .pau-slider {
        width: 100%;
        accent-color: #7a4af0;
        cursor: pointer;
      }
      .pau-stats-title {
        color: #b090ff;
        margin-bottom: 4px;
        font-size: 7px;
        letter-spacing: 1px;
      }
      #pau-stats-body div {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
        font-size: 7px;
        color: #c0b0e0;
      }
      #pau-stats-body .pau-score {
        color: #ffd700;
        font-size: 8px;
        margin-top: 4px;
        border-top: 1px solid #7a4af044;
        padding-top: 3px;
      }
      .pau-footer {
        display: flex;
        gap: 4px;
        margin-top: 6px;
        border-top: 1px solid #7a4af044;
        padding-top: 6px;
      }
      .pau-btn {
        flex: 1;
        background: #2a1a4e;
        border: 1px solid #7a4af0;
        color: #c8a8ff;
        font-family: inherit;
        font-size: 6px;
        padding: 3px 4px;
        cursor: pointer;
        border-radius: 3px;
      }
      .pau-btn:hover { background: #3a2a5e; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Toggle panel
    document.getElementById('poke-audio-toggle').addEventListener('click', () => {
      panelVisible = !panelVisible;
      document.getElementById('poke-audio-body').style.display = panelVisible ? 'block' : 'none';
      if (panelVisible) updateStatsPanel();
    });

    // SFX toggle
    document.getElementById('pau-sfx-toggle').addEventListener('change', (e) => {
      SETTINGS.sfxEnabled = e.target.checked;
      saveSettings();
    });

    // BGM toggle
    document.getElementById('pau-bgm-toggle').addEventListener('change', (e) => {
      SETTINGS.bgmEnabled = e.target.checked;
      if (!SETTINGS.bgmEnabled) stopBgm();
      else if (lastScreen) onScreenChange(lastScreen); // riattiva BGM corrente
      saveSettings();
    });

    // SFX volume
    document.getElementById('pau-sfx-vol').addEventListener('input', (e) => {
      SETTINGS.sfxVolume = parseFloat(e.target.value);
      saveSettings();
    });

    // BGM volume
    document.getElementById('pau-bgm-vol').addEventListener('input', (e) => {
      SETTINGS.bgmVolume = parseFloat(e.target.value);
      updateBgmVolume();
      saveSettings();
    });

    // Reset stats
    document.getElementById('pau-reset-stats').addEventListener('click', () => {
      Object.assign(RUN_STATS, {
        battles: 0, catches: 0, itemsFound: 0, badges: 0, levelUps: 0,
        shinyFound: 0, tradesCompleted: 0, pokecenterUsed: 0, faintsPlayer: 0,
        startTime: Date.now(), score: 0,
      });
      updateStatsPanel();
    });

    // Test SFX
    document.getElementById('pau-test-sfx').addEventListener('click', () => {
      SFX.BADGE();
    });

    // Aggiorna stats ogni 10s se il pannello è aperto
    statsInterval = setInterval(() => {
      if (panelVisible) updateStatsPanel();
    }, 10000);
  }

  function updateStatsPanel() {
    const el = document.getElementById('pau-stats-body');
    if (!el) return;
    calcScore();
    const elapsed = Date.now() - RUN_STATS.startTime;
    el.innerHTML = `
      <div><span>⚔️ Battaglie</span><span>${RUN_STATS.battles}</span></div>
      <div><span>🎯 Catture</span><span>${RUN_STATS.catches}</span></div>
      <div><span>🎒 Oggetti</span><span>${RUN_STATS.itemsFound}</span></div>
      <div><span>🏅 Medaglie</span><span>${RUN_STATS.badges}</span></div>
      <div><span>✨ Shiny</span><span>${RUN_STATS.shinyFound}</span></div>
      <div><span>⬆️ Level up</span><span>${RUN_STATS.levelUps}</span></div>
      <div><span>🔄 Scambi</span><span>${RUN_STATS.tradesCompleted}</span></div>
      <div><span>🏥 Pokecenter</span><span>${RUN_STATS.pokecenterUsed}</span></div>
      <div><span>💀 Svenuti</span><span>${RUN_STATS.faintsPlayer}</span></div>
      <div><span>⏱️ Tempo</span><span>${formatTime(elapsed)}</span></div>
      <div class="pau-score"><span>⭐ SCORE</span><span>${RUN_STATS.score.toLocaleString()}</span></div>
    `;
  }

  // ============================================================
  // INTEGRAZIONE TRACKING CON SCREEN OBSERVER
  // ============================================================
  const _origOnScreenChange = onScreenChange;
  // Patchato per includere il tracking stats
  function onScreenChangeFull(id) {
    _origOnScreenChange(id);
    trackScreenEvent(id);
  }

  // ============================================================
  // LOGGER
  // ============================================================
  function log(msg, color = '#9b59b6') {
    console.log(
      `%c[POKE-AUDIO] ${msg}`,
      `background:#1a0a2e;color:${color};font-weight:bold;padding:2px 5px;border:1px solid ${color};`
    );
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    log('PokeLike Audio Engine v5.0 avviato', '#2ecc71');
    createPanel();

    // Re-init observer con tracking
    function watchScreens() {
      const screens = document.querySelectorAll('.screen');
      if (screens.length === 0) { setTimeout(watchScreens, 500); return; }

      const obs = new MutationObserver(() => {
        const active = document.querySelector('.screen.active');
        if (active) onScreenChangeFull(active.id);
      });
      screens.forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
      log('Observer schermate (' + screens.length + ' trovate)', '#2ecc71');

      const activeNow = document.querySelector('.screen.active');
      if (activeNow) onScreenChangeFull(activeNow.id);
    }

    watchScreens();
    initBattleObserver();
    initToastObserver();
    initClickSounds();
  }

  // Avvia dopo che il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

})();
