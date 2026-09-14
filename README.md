# Twitch Space Game
Vite + Phaser + Typescript + Twitch Extension API

## Getting Started
Run the server and the page in two terminals, starting in this folder:

```bash
cd server
npm install
npm run server
```

```bash
cd panels
npm install
npm run dev
```

Open [the game](http://127.0.0.1:2053/game.html) or
[the Twitch panel](http://127.0.0.1:2053/panel.html).
The panel needs Twitch to sign a player in.

Local use does not need HTTPS certificates. For a public HTTPS server, set
`TLS_CERT_FILE` and `TLS_KEY_FILE` to your certificate and private key paths in
both terminals. Set `HOST` to the address to listen on (for example, `0.0.0.0`).
The default is `127.0.0.1`, which only accepts connections from this computer.
The game server uses port 2087 unless `PORT` is set.

For a public server, set `NODE_ENV=production` and `SESSION_SECRET` to a private,
random value of at least 32 bytes. Keep that value out of source control.
Local runs make a fresh key at startup, so local players get new sessions after
a server restart. Old tokens made with the former public key no longer work.

The commands below run from the `panels` folder.
### To run the project
```bash
npm run dev
```

### To build the project

```bash
npm run build
```

### To preview the build

```bash
npm run preview
```

### To lint check your code using eslint

```bash
npm run lint
```

### To lint check and fix your code

```bash
npm run lint-fix
```

`dist` your build will placed in this folder.
`src` you can structure your codes and folder as you like inside this folder.\
`public` your static asset must be placed inside this folder. You can also create new folder inside this folder.

## License
[License](LICENSE)
