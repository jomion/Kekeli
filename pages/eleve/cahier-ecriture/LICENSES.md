# Licences des dépendances tierces bundlées

Ce fichier liste les licences des bibliothèques JavaScript tierces bundlées dans
[`web/script.min.js`](web/script.min.js) via Rollup. La liste est maintenue
à jour lors de l'ajout/mise à jour d'une dépendance dans
[`package.json`](package.json).

Le projet Seyes lui-même est sous licence **GPL** (voir [`LICENSE`](LICENSE)).
Les polices sont sous licences séparées documentées dans
[`web/polices/licence`](web/polices/licence).

---

## @zumer/snapdom

- **Version** : 2.8.0
- **Licence** : MIT
- **Dépôt** : <https://github.com/zumerlab/snapdom>
- **Usage dans Seyes** : capture DOM → canvas pour la feature PDF, avec
  embarquement des polices locales (`snapdom.toCanvas`).

```
MIT License

Copyright (c) 2025 ZumerLab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Autres dépendances présentes dans `web/js/lib/`

Déjà présentes avant l'introduction de la feature PDF — licences à documenter
par les mainteneurs upstream :

- `web/js/lib/flatpickr.mjs` (flatpickr)
- `web/js/lib/flatpickr.min.css` (flatpickr)
- `web/js/lib/mammoth.browser.min.js` (mammoth.js, chargement dynamique sur
  import de fichier `.docx`)
- `web/js/lib/lirecouleur.mjs` (LireCouleur, ajout upstream récent)
