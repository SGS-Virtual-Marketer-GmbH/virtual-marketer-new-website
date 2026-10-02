# Roadmap (Stand 2026-10-02)

Technische SEO ist mit v46 durch. Der Engpass ist jetzt Sichtbarkeit (Startseite
Durchschnittsposition ca. 39, CTR 0,2 %, kaum Nicht-Marken-Suchen) und der
Betrieb des Builds.

## Erledigt (v46)
robots.txt ohne Render-Sperren, Sitemap mit hreflang und ehrlichem lastmod, EN-Beitraege
erst zum Termin, Article-Schema komplett, eindeutige Archiv-Titel, dünne Kategorien
noindex, index.html-301, WordPress-Reste entfernt, Gedankenstriche entfernt,
SEO-Audit im Build (`scripts/audit-seo.js`).

## 1. Betrieb (blockiert Veroeffentlichung)
- Build in Cloud Build statt auf dem Laptop; täglicher Scheduler, damit
  datierte Beiträge von selbst erscheinen (siehe Memory scheduled-posts-need-rebuild).
- Scrape `tmp_vm_scrape` sichern (Repo oder Bucket). Ohne ihn ist kein Rebuild möglich.
- Lifecycle-Regel für den Cloud-Build-Bucket (262 alte Tarballs, 1,5 GiB).

## 2. Search Console (braucht Zugriff, Profil fabian@)
- Neue Sitemap prüfen, Validierung für 404, Robots-Sperre, Duplikate starten.
- Abfragen und Seiten der letzten 90 Tage auswerten, daraus Ziel-Keywords je Lösungsseite.
- Verbleibende nicht indexierte Seiten nach 2 bis 4 Wochen neu bewerten.

## 3. Inhalt (grösster Hebel)
- Je Lösungsseite eine Suchintention und ein Ziel-Keyword festlegen (BLOG_STRATEGY.md).
- Die 84 Altbeiträge: dünne oder doppelte zusammenführen, Rest aktualisieren.
- EN-Fassungen der 41 neuen DE-Beiträge, danach hreflang automatisch.
- /en/demo/ hat nur 118 Wörter, ergänzen.

## 4. Technik (klein)
- Überschriftenebenen der Altbeiträge (h1 auf h6, 74 Seiten, Sidebar/Related-Boxen).
- Product-Schema auf Lösungsseiten: SoftwareApplication prüfen (offers fehlt).
- Dateinamen mit `?ver=` bereinigen.
- Bilder ohne Breite/Höhe (Logo im Header, 2 Seiten).
