<p align="center"><img src="logo.png" alt="Ciudad Aero" width="520"></p>

# 🫧 Ciudad Aero

Un juego chill con estética **Frutiger Aero**: pasea por la plaza y las zonas, juega a minijuegos, consigue perlas, personaliza tu personaje y decora tu propia casa.

## ▶️ Jugar

👉 **https://TU-USUARIO.github.io/ciudad-aero/**

## 📲 Instalar como aplicación

- **Android / Chrome:** abre el enlace → menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»).
- **iPhone / iPad (Safari):** abre el enlace → botón **Compartir** → **Añadir a pantalla de inicio**.
- **Ordenador (Chrome / Edge):** abre el enlace → icono de instalar ⊕ en la barra de direcciones.

Una vez instalada se abre a pantalla completa con su icono, y funciona también sin internet.

## 🎮 Controles

- **Ordenador:** WASD o flechas para moverte · **E** para interactuar · **Enter** para el chat rápido · **G** para emotes
- **Móvil:** arrastra el dedo para moverte y usa los botones de la pantalla

## 🌐 Modo online (chat, amigos, clasificación, casas y multijugador)

El juego usa **Firebase Realtime Database** (gratis) como servidor.

1. Entra en https://console.firebase.google.com y crea un proyecto (por ejemplo `ciudad-aero`). Puedes desactivar Google Analytics.
2. En el menú: **Compilación → Realtime Database → Crear base de datos** → elige la ubicación (Bélgica, `europe-west1`) → **Empezar en modo de prueba**.
3. Arriba verás una dirección como `https://ciudad-aero-xxxx-default-rtdb.europe-west1.firebasedatabase.app`. Cópiala.
4. Pestaña **Reglas** → borra lo que haya y pega el contenido de `reglas-firebase.json` → **Publicar**. (Incluye las cuentas de usuario.)
5. Abre `config.js` y pega la dirección entre las comillas de `databaseURL`. Sube el archivo a GitHub.

¡Listo! Todos los que abran el juego estarán en el mismo servidor.

## 🎵 Música

`musica.mp3` trae 6 temas chill que suenan en orden aleatorio. Puedes cambiarlo por otro archivo con el mismo nombre: el juego detecta las canciones por los silencios entre ellas.

## ℹ️ Nota

Si `config.js` está vacío, el juego funciona en solitario y la partida se guarda en el dispositivo.
