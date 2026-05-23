// ==UserScript==
// @name         PokeLike Tools v1.1
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  BuffFaker per pokelike.xyz
// @author       GitHub Copilot
// @match        https://pokelike.xyz/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Rimosso: bulk per generazione — ora si può cercare per ID o per nome



  // ============================================================
  // FETCH HELPER
  // ============================================================
  async function _fetchPoke(id) {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const name  = d.name.charAt(0).toUpperCase() + d.name.slice(1);
    const types = d.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1));
    const normalSprite = d.sprites.front_default
      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${d.id}.png`;
    const shinySprite  = d.sprites.front_shiny
      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${d.id}.png`;
    return { id: d.id, name, types, normalSprite, shinySprite };
  }



  // ============================================================
  // BUFFFAKER
  // ============================================================
  const BF_STATS = ['hp', 'atk', 'def', 'speed', 'special'];
  const BF_LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', speed: 'SPD', special: 'SPC' };

  function _bfGetStore() {
    try { return JSON.parse(localStorage.getItem('poke_stat_buffs') || '{}'); } catch { return {}; }
  }
  function _bfSaveStore(store) {
    try { localStorage.setItem('poke_stat_buffs', JSON.stringify(store)); } catch {}
  }

  function _bfGetRoot(id) {
    return typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(id) : id;
  }

  function _bfReadSliders() {
    const vals = {};
    BF_STATS.forEach(s => {
      vals[s] = parseInt(document.getElementById(`bf-stat-${s}`)?.value || '0', 10);
    });
    return vals;
  }

  function _bfShowCurrentBuffs(speciesId) {
    const store = _bfGetStore();
    const root  = _bfGetRoot(speciesId);
    const buffs = store[root] || {};
    BF_STATS.forEach(s => {
      const el = document.getElementById(`bf-stat-${s}`);
      const vl = document.getElementById(`bf-val-${s}`);
      const v  = buffs[s] ?? 0;
      if (el) el.value = v;
      if (vl) vl.textContent = v;
    });
  }

  async function _bfApply(speciesId, vals) {
    const store = _bfGetStore();
    const root  = _bfGetRoot(speciesId);
    store[root] = { ...vals };
    _bfSaveStore(store);
  }




  // ============================================================
  // PANNELLO UI UNIFICATO
  // ============================================================
  let panelVisible = false;

  function createPanel() {
    if (document.getElementById('pkt-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'pkt-panel';
    panel.innerHTML = `
      <div id="pkt-toggle" title="PokéTools">🛠️</div>
      <div id="pkt-body" style="display:none">

        <!-- ── BUFFFAKER ──────────────────────────────────── -->
        <div class="pkt-title">🌟 BuffFaker</div>

        <div class="pkt-section">
          <div class="pkt-label">Pokémon (ID o nome)</div>
          <div class="pkt-row">
            <input type="text" id="bf-id"
              placeholder="es. 137 o pikachu" class="pkt-input">
            <button id="bf-load-btn" class="pkt-btn">Carica</button>
          </div>
          <div id="bf-name" class="pkt-hint" style="margin-top:4px"></div>
        </div>

        <div class="pkt-section" id="bf-sliders" style="display:none">
          ${['hp','atk','def','speed','special'].map(s => `
          <div class="pkt-row" style="margin-bottom:4px">
            <span style="width:28px;font-size:6px;color:#9060cc">${s === 'special' ? 'SPC' : s === 'speed' ? 'SPD' : s.toUpperCase()}</span>
            <input type="range" id="bf-stat-${s}" min="0" max="10" value="0"
              class="pkt-slider" style="flex:1">
            <span id="bf-val-${s}" style="width:14px;text-align:right;font-size:7px">0</span>
          </div>`).join('')}
          <div class="pkt-row" style="margin-top:6px;gap:4px">
            <button id="bf-apply-btn" class="pkt-btn pkt-full">Applica</button>
            <button id="bf-max-btn"   class="pkt-btn pkt-full">Max tutto</button>
          </div>
        </div>

            <!-- Sezione bulk rimossa: ricerca libera per ID o nome sotto -->

        <div class="pkt-section">
          <div id="bf-status" class="pkt-status">—</div>
        </div>

      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #pkt-panel {
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 99999;
        font-family: "Press Start 2P", monospace, sans-serif;
        font-size: 9px;
      }
      #pkt-toggle {
        width: 36px; height: 36px;
        background: #1a0e2e;
        border: 2px solid #c050ff;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 18px;
        box-shadow: 0 0 8px #c050ff44;
        transition: transform 0.2s;
        user-select: none;
        margin-left: auto;
      }
      #pkt-toggle:hover { transform: scale(1.1); }
      #pkt-body {
        position: absolute;
        bottom: 44px; right: 0;
        background: #100820;
        border: 2px solid #c050ff;
        border-radius: 8px;
        padding: 12px 14px;
        min-width: 220px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 0 16px #c050ff33;
        color: #e0b0ff;
      }
      .pkt-title {
        font-size: 8px; letter-spacing: 1px;
        color: #c050ff;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #c050ff33;
      }
      .pkt-section { margin-bottom: 8px; }
      .pkt-label { font-size: 7px; color: #9060cc; margin-bottom: 4px; }
      .pkt-hint  { font-size: 6px; color: #7050aa; line-height: 1.7; }
      .pkt-row   { display: flex; gap: 6px; align-items: center; }
      .pkt-check-row {
        display: flex; gap: 6px; align-items: center;
        cursor: pointer; font-size: 7px; color: #e0b0ff;
        margin-bottom: 3px;
      }
      .pkt-check-row.pkt-main { font-size: 8px; color: #c050ff; margin-bottom: 5px; }
      .pkt-input {
        flex: 1; min-width: 0;
        background: #1e103a;
        border: 1px solid #c050ff;
        color: #e0b0ff;
        font-family: inherit; font-size: 7px;
        padding: 4px 6px; border-radius: 3px;
      }
      .pkt-select {
        width: 100%;
        background: #1e103a;
        border: 1px solid #c050ff;
        color: #e0b0ff;
        font-family: inherit; font-size: 7px;
        padding: 4px 6px; border-radius: 3px;
        cursor: pointer;
      }
      .pkt-btn {
        background: #1e103a;
        border: 1px solid #c050ff;
        color: #e0b0ff;
        font-family: inherit; font-size: 7px;
        padding: 4px 8px; border-radius: 3px;
        cursor: pointer; white-space: nowrap;
      }
      .pkt-btn:hover { background: #2e1a50; }
      .pkt-btn.pkt-full { width: 100%; display: block; }
      .pkt-btn-red { border-color: #ff4444; color: #ff9999; }
      .pkt-btn-red:hover { background: #3a0a0a; }
      .pkt-status   { font-size: 7px; color: #a080d0; min-height: 12px; word-break: break-all; }
      .pkt-progress { font-size: 9px; color: #c050ff; margin-top: 3px; font-weight: bold; }
      .pkt-slider   { width: 100%; accent-color: #c050ff; cursor: pointer; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    const toggleEl = document.getElementById('pkt-toggle');
    const bodyEl   = document.getElementById('pkt-body');

    // Toggle pannello
    toggleEl.addEventListener('click', () => {
      panelVisible = !panelVisible;
      bodyEl.style.display = panelVisible ? 'block' : 'none';
    });

    // ── BuffFaker ─────────────────────────────────────────────
    const bfStatusEl  = document.getElementById('bf-status');
    const bfSlidersEl = document.getElementById('bf-sliders');
    const bfNameEl    = document.getElementById('bf-name');
    let   _bfCurrentId = null;

    // Aggiorna label valore accanto allo slider
    BF_STATS.forEach(s => {
      const el = document.getElementById(`bf-stat-${s}`);
      const vl = document.getElementById(`bf-val-${s}`);
      if (el && vl) el.addEventListener('input', () => { vl.textContent = el.value; });
    });

    document.getElementById('bf-load-btn').addEventListener('click', async () => {
      const raw = (document.getElementById('bf-id').value || '').trim();
      if (!raw) { bfStatusEl.textContent = '⚠ Inserisci ID o nome'; return; }
      bfNameEl.textContent  = 'Caricamento…';
      bfSlidersEl.style.display = 'none';
      try {
        const query = Number.isFinite(Number(raw)) ? Number(raw) : raw.toLowerCase();
        const data = await _fetchPoke(query);
        _bfCurrentId = data.id;
        bfNameEl.textContent = `#${data.id} ${data.name}`;
        _bfShowCurrentBuffs(data.id);
        bfSlidersEl.style.display = 'block';
        bfStatusEl.textContent = 'Modifica i valori e clicca Applica';
      } catch {
        bfNameEl.textContent = '❌ Non trovato';
        bfStatusEl.textContent = '';
      }
    });

    document.getElementById('bf-apply-btn').addEventListener('click', async () => {
      if (!_bfCurrentId) return;
      const vals = _bfReadSliders();
      await _bfApply(_bfCurrentId, vals);
      bfStatusEl.textContent = `✅ Buff applicati a #${_bfCurrentId}`;
    });

    document.getElementById('bf-max-btn').addEventListener('click', async () => {
      if (!_bfCurrentId) return;
      BF_STATS.forEach(s => {
        const el = document.getElementById(`bf-stat-${s}`);
        const vl = document.getElementById(`bf-val-${s}`);
        if (el) el.value = 10;
        if (vl) vl.textContent = '10';
      });
      const vals = Object.fromEntries(BF_STATS.map(s => [s, 10]));
      await _bfApply(_bfCurrentId, vals);
      bfStatusEl.textContent = `⭐ Tutto maxato per #${_bfCurrentId}`;
    });

    // Bulk per generazione rimosso — nessun listener necessario
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    createPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();