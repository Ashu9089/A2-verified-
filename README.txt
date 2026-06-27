INLIST PWA setup

Files:
- index.html
- manifest.webmanifest
- sw.js
- icons/icon-192.png
- icons/icon-512.png

Use:
1. Upload all files/folders together to your hosting root or GitHub Pages repository.
2. Open with HTTPS, not file://. Local test: python -m http.server 5500 then open http://localhost:5500/index.html
3. On Android Chrome, open the page and tap the orange “Install App” button, or Chrome menu > Add to Home screen.

Important:
- Service worker works only on HTTPS or localhost.
- Keep sw.js, manifest.webmanifest, and index.html in the same folder.
