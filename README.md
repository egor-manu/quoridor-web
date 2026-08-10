# Quoridor

A polished, touch-first browser version of Quoridor for playing against a local AI or controlling both players locally. It supports 7×7, 9×9, and 11×11 boards, four difficulty modes, optional shortest-path lengths, unified tap-and-swipe controls, undo, local preferences, and offline play. No account, backend, analytics, or network connection is needed after the first load.

**Live game:** https://egor-manu.github.io/quoridor-web/

## Local development

```bash
npm install
npm run dev
```

Open the localhost address shown by Vite (normally `http://localhost:5173`).

To verify the production build locally:

```bash
npm run build
npm run preview
```

Run the rule and AI tests with `npm test`.

## GitHub Pages

The included workflow tests and builds the app on every push to `main`, then publishes the static `dist` directory with GitHub Pages. Vite uses relative asset paths, so the site works from a repository subpath such as `https://username.github.io/quoridor-web/`.

In the repository settings, select **GitHub Actions** as the Pages source before the first deployment.

## Rules and privacy

Movement, jumps, diagonal jumps, walls, path preservation, and victory follow the standard two-player Quoridor rules. Preferences and adaptive progress stay in the browser's local storage.

## License

Private project. Add a license file before distributing or accepting contributions.

Quoridor is a trademark of its respective owner. This is an independent implementation and is not affiliated with the original publisher.
