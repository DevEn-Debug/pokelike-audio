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
    // extract base stats for attack heuristics
    const stats = {};
    (d.stats || []).forEach(s => { stats[s.stat.name] = s.base_stat; });
    const baseAttack = stats['attack'] || 0;
    const baseSpAttack = stats['special-attack'] || 0;
    return { id: d.id, name, types, normalSprite, shinySprite, baseAttack, baseSpAttack };
  }



  // ============================================================
  // BUFFFAKER
  // ============================================================
  const BF_STATS = ['hp', 'def', 'spe', 'spatk', 'spdef'];
  const BF_LABELS = { hp: 'HP', def: 'DEF', spe: 'SPE', atk: 'ATK', spatk: 'SP.A', spdef: 'SP.D' };

  function _bfGetStore() {
    try { return JSON.parse(localStorage.getItem('poke_stat_buffs') || '{}'); } catch { return {}; }
  }
  function _bfSaveStore(store) {
    try { localStorage.setItem('poke_stat_buffs', JSON.stringify(store)); } catch {}
  }

  function _bfGetRoot(id) {
    return typeof window.getEvoLineRoot === 'function' ? window.getEvoLineRoot(id) : id;
  }

  function _bfParseQuery(input) {
    const clean = String(input || '').trim();
    if (!clean) return null;
    return clean.match(/^\d+$/) ? Number(clean) : clean.toLowerCase();
  }

  function _bfCountUnlockedRegions() {
    try {
      // DOM-based detection tailored to the Battle Tower stage selector
      // (looks for buttons inside #stage-select-list / #endless-stage-select)
      const list = document.querySelector('#endless-stage-select #stage-select-list')
                || document.querySelector('#stage-select-list');
      if (list) {
        const buttons = Array.from(list.querySelectorAll('button'));
        const unlocked = new Set();

        buttons.forEach(btn => {
          const text = (btn.textContent || '').trim();
          if (!text) return;

          // Heuristics to decide if a button is locked:
          // - contains explicit lock glyph/text (🔒, LOCK)
          // - disabled attribute or aria-disabled="true"
          // - visual cues: low opacity or cursor: not-allowed
          // - button styling: `.btn-secondary` usually means locked in the provided markup
          const isLockedByText = /LOCK|🔒/i.test(text);
          const ariaDisabled = btn.getAttribute('aria-disabled') === 'true';
          const disabled = !!btn.disabled || ariaDisabled;

          let styleLocked = false;
          try {
            const cs = window.getComputedStyle(btn);
            if (cs) {
              const op = parseFloat(cs.opacity || '1');
              if (op && op < 0.7) styleLocked = true;
              if (cs.cursor === 'not-allowed') styleLocked = true;
            }
          } catch {}

          const hasSecondary = btn.classList.contains('btn-secondary');
          const hasPrimary = btn.classList.contains('btn-primary');
          const locked = disabled || isLockedByText || styleLocked || (hasSecondary && !hasPrimary);

          if (!locked) {
            // Extract a short region name (e.g., "Kanto", "Johto") to avoid duplicates
            const m = text.match(/([A-Za-zÀ-ÖØ-öø-ÿ]+)/);
            const name = m ? m[1].toUpperCase() : text.toUpperCase();
            unlocked.add(name);
          }
        });

        if (unlocked.size > 0) return unlocked.size;
      }
    } catch {}

    try {
      const save = JSON.parse(localStorage.getItem('save') || '{}');
      const regions = save?.battleTower?.regions || save?.towerProgress || null;
      if (regions && typeof regions === 'object') {
        return Object.values(regions).filter(v => v === true || (typeof v === 'number' && v > 0)).length || 1;
      }
    } catch {}

    return 1;
  }

  function _bfGetTotalPoints() {
    return _bfCountUnlockedRegions() * 10;
  }

  function _bfReadSliders() {
    const vals = {};
    document.querySelectorAll('[id^="bf-stat-"]').forEach(el => {
      // only read visible sliders
      if (el.offsetParent === null) return;
      const m = el.id.match(/^bf-stat-(.+)$/);
      if (!m) return;
      const key = m[1];
      vals[key] = parseInt(el.value || '0', 10) || 0;
    });
    return vals;
  }

  function _bfSumSliders() {
    let sum = 0;
    document.querySelectorAll('[id^="bf-stat-"]').forEach(el => {
      if (el.offsetParent === null) return;
      sum += parseInt(el.value || '0', 10) || 0;
    });
    return sum;
  }

  function _bfUpdateUsage() {
    const total = _bfGetTotalPoints();
    const used = _bfSumSliders();
    const usageEl = document.getElementById('bf-used-points');
    const maxEl = document.getElementById('bf-max-points');
    const statusEl = document.getElementById('bf-status');
    if (maxEl) maxEl.textContent = `Punti disponibili: ${total}`;
    if (usageEl) usageEl.textContent = `Usati: ${used}`;
    if (statusEl) {
      if (used > total) {
        statusEl.textContent = `⚠ Hai superato il limite di ${total} punti`;
      } else if (used === total) {
        statusEl.textContent = `Budget al massimo`;
      } else {
        statusEl.textContent = `Usa fino a ${total} punti in totale`;
      }
    }
  }

  const _bfLastValidValues = {};

  let _bfLastFetched = null; // last fetched Pokemon data (contains baseAttack/baseSpAttack)

  function _bfChooseAttackSlot(prefer) {
    // prefer: 'atk' or 'spatk'
    const atkEl = document.getElementById('bf-stat-atk');
    const spatkEl = document.getElementById('bf-stat-spatk');
    const atkVal = document.getElementById('bf-val-atk');
    const spatkVal = document.getElementById('bf-val-spatk');
    const atkLabel = document.getElementById('bf-label-atk');
    if (!atkEl || !spatkEl) return;
    if (prefer === 'atk') {
      atkEl.style.display = '';
      atkVal.style.display = '';
      if (atkLabel) atkLabel.textContent = BF_LABELS['atk'];
      spatkEl.style.display = 'none';
      spatkVal.style.display = 'none';
    } else {
      spatkEl.style.display = '';
      spatkVal.style.display = '';
      if (atkLabel) atkLabel.textContent = BF_LABELS['spatk'];
      atkEl.style.display = 'none';
      atkVal.style.display = 'none';
    }
  }

  function _bfShowCurrentBuffs(speciesOrData) {
    // speciesOrData can be an id or the full data object returned by _fetchPoke
    let speciesId = speciesOrData;
    if (speciesOrData && typeof speciesOrData === 'object') {
      speciesId = speciesOrData.id;
      _bfLastFetched = speciesOrData;
    }

    const store = _bfGetStore();
    const root  = _bfGetRoot(speciesId);
    const buffs = store[root] || {};

    // Common stats
    ['hp', 'def', 'spe', 'spdef'].forEach(s => {
      const el = document.getElementById(`bf-stat-${s}`);
      const vl = document.getElementById(`bf-val-${s}`);
      const v  = Math.min(10, Math.max(0, buffs[s] ?? 0));
      if (el) {
        el.value = v;
        _bfLastValidValues[s] = v;
      }
      if (vl) vl.textContent = v;
    });

    // Attack: set both sliders values then choose which to show
    const atkVal = Math.min(10, Math.max(0, buffs['atk'] ?? 0));
    const spatkVal = Math.min(10, Math.max(0, buffs['spatk'] ?? 0));
    const atkEl = document.getElementById('bf-stat-atk');
    const atkVl = document.getElementById('bf-val-atk');
    const spatkEl = document.getElementById('bf-stat-spatk');
    const spatkVl = document.getElementById('bf-val-spatk');
    if (atkEl) { atkEl.value = atkVal; _bfLastValidValues['atk'] = atkVal; }
    if (atkVl) atkVl.textContent = atkVal;
    if (spatkEl) { spatkEl.value = spatkVal; _bfLastValidValues['spatk'] = spatkVal; }
    if (spatkVl) spatkVl.textContent = spatkVal;

    // Decide preference: prefer physical if base attack >= special-attack when we have data
    let prefer = 'atk';
    if (_bfLastFetched && typeof _bfLastFetched.baseAttack === 'number') {
      prefer = (_bfLastFetched.baseAttack >= (_bfLastFetched.baseSpAttack || 0)) ? 'atk' : 'spatk';
    } else if (spatkVal > atkVal) {
      prefer = 'spatk';
    }
    _bfChooseAttackSlot(prefer);
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
        <div class="pkt-label" style="border-bottom: 1px solid #c050ff33;margin-bottom: 8px;padding-bottom: 8px">
          Prima di cercare il Pokémon posizionati sulla selezione delle tower
        </div>
        <div class="pkt-section">
          <div class="pkt-label">Pokémon (ID o nome)</div>
          <div class="pkt-row">
            <input type="text" id="bf-id" class="pkt-input" placeholder="es. 137 o bulbasaur">
            <button id="bf-load-btn" class="pkt-btn">Cerca</button>
          </div>
          <div id="bf-name" class="pkt-hint" style="margin-top:4px"></div>
        </div>

        <div class="pkt-section" id="bf-sliders" style="display:none">
          <div class="pkt-row" style="margin-bottom:4px">
            <span style="width:28px;font-size:6px;color:#9060cc">${BF_LABELS['hp']}</span>
            <input type="range" id="bf-stat-hp" min="0" max="10" value="0" class="pkt-slider" style="flex:1">
            <span id="bf-val-hp" style="width:14px;text-align:right;font-size:7px">0</span>
          </div>
          <div class="pkt-row" style="margin-bottom:4px">
            <span style="width:28px;font-size:6px;color:#9060cc">${BF_LABELS['def']}</span>
            <input type="range" id="bf-stat-def" min="0" max="10" value="0" class="pkt-slider" style="flex:1">
            <span id="bf-val-def" style="width:14px;text-align:right;font-size:7px">0</span>
          </div>
          <div class="pkt-row" style="margin-bottom:4px">
            <span style="width:28px;font-size:6px;color:#9060cc">${BF_LABELS['spe']}</span>
            <input type="range" id="bf-stat-spe" min="0" max="10" value="0" class="pkt-slider" style="flex:1">
            <span id="bf-val-spe" style="width:14px;text-align:right;font-size:7px">0</span>
          </div>

          <!-- Attack slot: two sliders (ATK and SP.ATK) - only one shown at a time -->
          <div class="pkt-row" style="margin-bottom:4px">
            <span id="bf-label-atk" style="width:28px;font-size:6px;color:#9060cc">${BF_LABELS['atk']}</span>
            <input type="range" id="bf-stat-atk" min="0" max="10" value="0" class="pkt-slider" style="flex:1">
            <input type="range" id="bf-stat-spatk" min="0" max="10" value="0" class="pkt-slider" style="flex:1;display:none;margin-left:6px">
            <span id="bf-val-atk" style="width:14px;text-align:right;font-size:7px">0</span>
            <span id="bf-val-spatk" style="width:14px;text-align:right;font-size:7px;display:none">0</span>
          </div>

          <div class="pkt-row" style="margin-bottom:4px">
            <span style="width:28px;font-size:6px;color:#9060cc">${BF_LABELS['spdef']}</span>
            <input type="range" id="bf-stat-spdef" min="0" max="10" value="0" class="pkt-slider" style="flex:1">
            <span id="bf-val-spdef" style="width:14px;text-align:right;font-size:7px">0</span>
          </div>
          <div class="pkt-row" style="margin-top:6px;gap:4px">
            <button id="bf-apply-btn" class="pkt-btn pkt-full">Applica</button>
          </div>
          <div class="pkt-row" style="margin-top:4px;gap:4px;font-size:7px;color:#b0c0ff">
            <span id="bf-max-points">Punti disponibili: 10</span>
            <span id="bf-used-points" style="margin-left:auto">Usati: 0</span>
          </div>
        </div>

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
        margin-bottom: 4px;
        padding-bottom: 4px;
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

    // Aggiorna label valore accanto allo slider e l'uso totale (per tutti gli slider presenti)
    Array.from(document.querySelectorAll('.pkt-slider')).forEach(el => {
      const m = el.id.match(/^bf-stat-(.+)$/);
      if (!m) return;
      const s = m[1];
      const vl = document.getElementById(`bf-val-${s}`);
      el.addEventListener('input', () => {
        const value = Math.min(10, Math.max(0, parseInt(el.value, 10) || 0));
        const previous = _bfLastValidValues[s] ?? 0;
        el.value = value;
        const used = _bfSumSliders();
        if (used > _bfGetTotalPoints()) {
          el.value = previous;
          if (vl) vl.textContent = previous;
        } else {
          _bfLastValidValues[s] = value;
          if (vl) vl.textContent = value;
        }
        _bfUpdateUsage();
      });
    });

    document.getElementById('bf-load-btn').addEventListener('click', async () => {
      const raw = document.getElementById('bf-id').value;
      const query = _bfParseQuery(raw);
      if (!query) { bfStatusEl.textContent = '⚠ Inserisci un ID o un nome valido'; return; }
      bfNameEl.textContent = 'Caricamento…';
      bfSlidersEl.style.display = 'none';
      try {
        const data = await _fetchPoke(query);
        _bfCurrentId = data.id;
        _bfLastFetched = data;
        bfNameEl.textContent = `#${data.id} ${data.name}`;
        _bfShowCurrentBuffs(data);
        bfSlidersEl.style.display = 'block';
        _bfUpdateUsage();
      } catch {
        bfNameEl.textContent = '❌ Non trovato';
        bfStatusEl.textContent = '';
      }
    });

    document.getElementById('bf-apply-btn').addEventListener('click', async () => {
      if (!_bfCurrentId) return;
      const vals = _bfReadSliders();
      const total = _bfGetTotalPoints();
      const used = _bfSumSliders();
      if (used > total) {
        bfStatusEl.textContent = `⚠ Limite superato: ${used}/${total}`;
        return;
      }
      await _bfApply(_bfCurrentId, vals);
      bfStatusEl.textContent = `✅ Buff applicati a #${_bfCurrentId} (${used}/${total})`;
    });
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
