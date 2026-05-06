# PokeLike Audio Engine 🎵

CDN per file audio del Tampermonkey script **PokeLike Audio Engine v5.0** per [pokelike.xyz](https://pokelike.xyz).

## 📁 Struttura

```
pokelike-audio/
├── index.html              ← pagina CDN (GitHub Pages)
├── script/
│   └── pokelike-audio.user.js   ← Tampermonkey script
└── audio/
    ├── bgm/
    │   ├── map.mp3         ← musica mappa / navigazione
    │   ├── battle.mp3      ← musica battaglia normale
    │   ├── boss.mp3        ← musica boss / palestra
    │   ├── elite.mp3       ← musica Elite 4
    │   └── win.mp3         ← jingle vittoria
    └── sfx/
        ├── wild.mp3        ← incontro selvatico
        ├── trainer.mp3     ← incontro allenatore
        ├── gym.mp3         ← incontro capopalestra
        ├── catch.mp3       ← schermata cattura
        ├── item.mp3        ← oggetto trovato
        ├── heal.mp3        ← pokécenter
        ├── trade.mp3       ← scambio / move tutor
        ├── shiny.mp3       ← pokémon shiny apparso
        ├── legendary.mp3   ← leggendario apparso
        ├── badge.mp3       ← medaglia ottenuta
        ├── levelup.mp3     ← level up
        ├── faint.mp3       ← pokémon sviene
        ├── gameover.mp3    ← game over
        ├── victory.mp3     ← vittoria partita
        └── select.mp3      ← selezione starter / click
```

## 🔧 Aggiungere audio

1. Carica i tuoi `.mp3` nelle cartelle `audio/sfx/` o `audio/bgm/` con i **nomi esatti** mostrati sopra
2. Fai commit & push
3. I file saranno disponibili su:

```
https://DevEn-Debug.github.io/pokelike-audio/audio/sfx/NOME.mp3
https://DevEn-Debug.github.io/pokelike-audio/audio/bgm/NOME.mp3
```

## 📥 Script

Lo script Tampermonkey è in `script/pokelike-audio.user.js`.  
Nello script, le URL degli MP3 sono configurabili in cima al file nei blocchi `MP3_BGM` e `MP3_SFX`.

Se le URL sono vuote (`''`), lo script usa automaticamente la **sintesi Web Audio API** – nessun file necessario.

## 🌐 GitHub Pages

Dopo aver attivato GitHub Pages su questo repo (Settings → Pages → Deploy from branch `main`), la pagina CDN sarà disponibile su:

```
https://DevEn-Debug.github.io/pokelike-audio/
```
