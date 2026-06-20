# PokeLike Toolkit 🎮

Toolkit all-in-one per [pokelike.xyz](https://pokelike.xyz): audio engine, DexFaker, StarterPC e BuffFaker in un unico widget Tampermonkey.

## ✨ Funzionalità

| Tab | Nome | Descrizione |
|-----|------|-------------|
| 🔊 | **Audio** | SFX (MP3 o sintesi Web Audio), volume musica di gioco, bypass manutenzione, transizioni istantanee su desktop |
| 📖 | **Pokédex** | DexFaker - aggiungi Pokemon al Pokedex (numero o nome), opzione Shiny |
| 🖥️ | **Starter PC** | StarterPC - un Pokemon nel PC della Battle Tower (numero o nome) |
| ⚡ | **EV / Buff** | BuffFaker — modifica stat buff per singolo Pokémon |

## 📁 Struttura

```
pokelike-audio/
├── index.html                    ← pagina installazione (GitHub Pages)
├── script/
│   └── pokelike-audio.user.js    ← Tampermonkey script (PokeLike Toolkit v6.0)
└── audio/
    ├── bgm/                      ← musiche di sottofondo
    └── sfx/                      ← effetti sonori
```

## 🔧 Aggiungere audio

1. Carica i tuoi `.mp3` in `audio/sfx/` o `audio/bgm/`
2. Commit & push
3. I file saranno disponibili su:

```
https://DevEn-Debug.github.io/pokelike-audio/audio/sfx/NOME.mp3
https://DevEn-Debug.github.io/pokelike-audio/audio/bgm/NOME.mp3
```

Le URL sono configurabili in cima allo script nei blocchi `MP3_BGM` e `MP3_SFX`.  
Se una URL è vuota (`''`), lo script usa la **sintesi Web Audio API**.

## 📥 Installazione

1. Installa [Tampermonkey](https://www.tampermonkey.net/)
2. Apri la [pagina di installazione](https://DevEn-Debug.github.io/pokelike-audio/)
3. Clicca **Installa PokeLike Toolkit**
4. Vai su [pokelike.xyz](https://pokelike.xyz) — widget in basso a sinistra

## 🌐 GitHub Pages

```
https://DevEn-Debug.github.io/pokelike-audio/
```
