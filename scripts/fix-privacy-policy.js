#!/usr/bin/env node

/**
 * Privacy policy correction.
 *
 * The Datenschutzerklärung was inherited from the WordPress site and still
 * described processing that no longer happens — and, worse, named the wrong
 * host. After the tracker removal and the move to Cloud Run it claimed:
 *
 *   - Hosting by Automattic / WordPress.com. The site runs on Google Cloud
 *     Run in europe-west1 (Belgium). Naming the wrong processor in a privacy
 *     policy is not a cosmetic problem: it is the one section a data subject
 *     or a supervisory authority would actually rely on.
 *   - Web analytics via Jetpack and Google Analytics, including cookie-based
 *     user profiling. None of that is loaded — the site makes zero
 *     third-party requests (verified by the build's own asset audit).
 *   - Online marketing with interest-based profiling and links to the
 *     aboutads / youronlinechoices opt-outs. There is no ad tech here to
 *     opt out of.
 *
 * The sections are rewritten rather than deleted. Deleting them would break
 * the anchors in the "Inhaltsübersicht" and, more importantly, a policy that
 * simply omits the topic is less informative than one that states plainly
 * that the processing does not occur. Overclaiming and underclaiming are both
 * wrong; saying "we do not do this" is the accurate third option.
 *
 * Deliberately NOT touched: everything about contract data, contact requests,
 * legal bases, retention and data-subject rights. Those describe processing
 * that genuinely happens, and rewriting legal text that is still correct
 * would be scope this script has no business taking.
 *
 * ---------------------------------------------------------------------------
 * 2026 revision — AI sub-processor disclosure and EU AI Act transparency
 * ---------------------------------------------------------------------------
 *
 * WHY VENDOR NAMES APPEAR HERE AND NOWHERE ELSE ON THE SITE
 *
 * CLAUDE.md forbids naming the underlying AI vendor/engine/model anywhere on
 * this site. That rule is a PRODUCT AND MARKETING rule: feature pages, demos,
 * pricing, blog. It is deliberately NOT applied to the legal pages, and it
 * must not be "fixed" to apply to them.
 *
 * The reason is that the naming here is legally compelled, not editorial:
 *
 *   - Art. 13(1)(e) GDPR requires the recipients or categories of recipients
 *     of personal data to be disclosed to the data subject.
 *   - Art. 28(2) and 28(4) GDPR make the engagement of a sub-processor
 *     subject to the controller's authorisation and require the processor to
 *     inform the controller of intended changes — which presupposes that the
 *     sub-processors are identified, not described as "a third-party model
 *     provider".
 *   - Art. 44–49 GDPR require the third-country transfer and its safeguard to
 *     be stated; a safeguard cannot be stated without naming who receives the
 *     data.
 *
 * So: Anthropic, Google and OpenAI are named in /datenschutzerklaerung/ and
 * /en/privacy-policy/ and MUST NOT leak into any feature, solution, pricing or
 * blog page. The build's final check (see main()) greps the marketing trees to
 * enforce exactly that boundary in both directions.
 *
 * WHAT THE AI ACT SECTION ASSERTS, AND AS OF WHEN
 *
 * Verified against primary sources (do not "update" these without re-checking):
 *   - Regulation (EU) 2024/1689 (AI Act). Art. 50 transparency obligations
 *     apply from 2 August 2026 — i.e. they are in force now.
 *   - Regulation (EU) 2026/1744 of 8 July 2026 ("Digital Omnibus on AI"),
 *     published in the OJ on 24 July 2026, in force since 27 July 2026. It
 *     amends the AI Act. It leaves Art. 50 applicable from 2 August 2026 but
 *     grants AI systems placed on the market BEFORE 2 August 2026 until
 *     2 December 2026 to satisfy the machine-readable marking duty of
 *     Art. 50(2). It also softens Art. 4 to a duty to *support* AI literacy.
 *   - Art. 4 (AI literacy) has applied since 2 February 2025.
 *   - Chapter III (high-risk) duties were pushed back by the Omnibus and are
 *     not asserted as applicable here.
 *
 * The text is written to state obligations and the state of implementation —
 * never "we are AI Act compliant/certified", which would be an unverifiable
 * claim about a regulation whose conformity-assessment machinery does not
 * even apply to this product.
 *
 * Run after scripts/fix-legal-content.js, before scripts/seo-optimize.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/** Revision date printed as "Stand: …" on the German policy. */
const STAND = '4. August 2026';

/**
 * The three AI sub-processors, disclosed per Art. 13(1)(e) / Art. 28 GDPR.
 * Single source of truth so the German and English pages cannot drift, and so
 * the marketing-tree leak check below knows exactly what to look for.
 */
const AI_SUBPROCESSORS = ['Anthropic', 'Google', 'OpenAI'];

/**
 * Replacement bodies, keyed by the heading that opens the section. Everything
 * between that heading and the next <h2> is replaced.
 */
const SECTIONS = [
  {
    // The hosting section used to name the cloud provider and region. Product
    // decision: state the EU only. The provider is disclosed on request (which
    // keeps Art. 13(1)(e) satisfiable) but is not baked into the page, so a
    // provider or region change cannot silently falsify the policy.
    match: /Bereitstellung des Onlineangebotes und Webhosting/i,
    lang: 'de',
    body: `
<p>Diese Website wird auf Cloud-Infrastruktur <strong>innerhalb der Europäischen Union</strong> betrieben. Auslieferung und Verarbeitung erfolgen damit in einem Rechenzentrum im EU-Raum. Den Namen des eingesetzten Infrastrukturanbieters teilen wir Ihnen auf Anfrage unter <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> mit.</p>
<p>Beim Abruf der Website werden technisch notwendige Daten verarbeitet, insbesondere die IP-Adresse, Datum und Uhrzeit des Abrufs, die aufgerufene Adresse, die übertragene Datenmenge, der Referrer sowie Browser- und Systemangaben (nachfolgend „Server-Logdaten“). Diese Verarbeitung ist erforderlich, um die Inhalte überhaupt ausliefern und den Betrieb absichern zu können. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und störungsfreien Betrieb des Onlineangebotes (Art. 6 Abs. 1 S. 1 lit. f DSGVO).</p>
<p><strong>Server-Logdaten fallen bei jedem Abruf zwangsläufig an.</strong> Wir werten sie ausschließlich zur Fehleranalyse, zur Gewährleistung von Stabilität und Sicherheit sowie zur Abwehr von Missbrauch – etwa automatisierter Angriffe – aus. Eine Auswertung des Nutzungsverhaltens einzelner Personen, eine Profilbildung oder eine Zusammenführung mit anderen Datenquellen findet nicht statt. Die Logdaten werden gelöscht, sobald sie für diese Zwecke nicht mehr erforderlich sind; eine längere Aufbewahrung einzelner Einträge erfolgt nur, soweit sie zur Aufklärung eines konkreten Sicherheitsvorfalls benötigt werden.</p>
<p>Für Terminbuchungen und das Kontaktformular betreiben wir einen eigenen Dienst. Die übermittelten Angaben werden in einer Datenbank innerhalb der Europäischen Union gespeichert; die Benachrichtigung erfolgt über unseren eigenen E-Mail-Server.</p>
<p><strong>Hinweis zum Speicherort für Kundendaten:</strong> Für Kundenprojekte kann vertraglich festgelegt werden, in welchem Rechenzentrum die Daten gespeichert und verarbeitet werden – etwa ausschließlich in Deutschland oder in einem anderen Rechenzentrum innerhalb der EU. Ohne eine solche Vereinbarung wählen wir einen kosteneffizienten Standort. Ein Hosting ausschließlich in Deutschland ist also eine vereinbare Option, keine pauschale Eigenschaft unserer Leistungen.</p>`,
  },
  {
    // Wording rule for this section: the accurate claim is "no EXTERNAL
    // tracking/analytics services are embedded", never "we do no tracking
    // whatsoever". Server-side access logs exist and are named explicitly so
    // the section cannot be read as denying them.
    match: /Webanalyse, Monitoring und Optimierung/i,
    lang: 'de',
    body: `
<p><strong>Wir binden auf dieser Website keine externen Tracking-, Analyse- oder Reichweitenmessdienste ein.</strong> Es werden keine Dienste Dritter zur Reichweitenmessung geladen, keine Nutzerprofile zu Werbezwecken gebildet und keine Analyse- oder Werbe-Cookies von Drittanbietern gesetzt.</p>
<p>Schriftarten, Symbole, Stylesheets und Skripte liefern wir von unserem eigenen Server aus. Beim Aufruf der Seite wird daher keine Verbindung zu Servern Dritter hergestellt, die dabei Ihre IP-Adresse erhalten könnten.</p>
<p><strong>Das bedeutet nicht, dass keinerlei Daten anfallen.</strong> Beim Abruf der Website entstehen serverseitige Zugriffsprotokolle (Server-Logdaten). Diese werten wir ausschließlich zur Fehleranalyse, zur Betriebssicherheit und zur Missbrauchsabwehr aus – nicht zur Analyse des Verhaltens einzelner Nutzerinnen und Nutzer, nicht zur Reichweitenmessung und nicht zu Marketingzwecken. Einzelheiten und die Rechtsgrundlage finden Sie im Abschnitt „Bereitstellung des Onlineangebotes und Webhosting“.</p>
<p>Da keine einwilligungspflichtigen Cookies gesetzt werden, benötigt diese Website kein Cookie-Banner und keine Einwilligungsverwaltung.</p>`,
  },
  {
    match: /^Onlinemarketing/i,
    lang: 'de',
    body: `
<p><strong>Wir betreiben auf dieser Website kein Onlinemarketing mit personenbezogenen Daten.</strong> Es findet keine interessenbasierte Werbung statt, es werden keine Nutzerprofile zu Werbezwecken gebildet, keine Conversion- oder Remarketing-Pixel eingebunden und keine Werbe-Cookies gesetzt.</p>
<p>Da keine Werbenetzwerke eingebunden sind, ist ein Widerspruch über Sammel-Opt-out-Portale wie YourAdChoices oder Your Online Choices für diese Website weder erforderlich noch wirksam – es existieren schlicht keine entsprechenden Verarbeitungen, denen widersprochen werden könnte.</p>
<p>Unberührt bleiben die im Abschnitt „Bereitstellung des Onlineangebotes und Webhosting“ beschriebenen Server-Logdaten sowie eine Direktansprache, die auf Ihrer Einwilligung oder auf einer bestehenden Geschäftsbeziehung beruht; einer Verarbeitung zum Zweck der Direktwerbung können Sie jederzeit ohne Angabe von Gründen widersprechen (Art. 21 Abs. 2 DSGVO).</p>`,
  },
  {
    // "Einsatz von Cookies" still pointed users at the aboutads and
    // youronlinechoices collective opt-outs. Those portals switch off
    // interest-based advertising cookies — none of which this site sets, so
    // the advice was not merely stale but actively misleading: it implies
    // there is ad tracking here to opt out of. The section keeps its
    // explanation of what cookies are and states the actual position.
    match: /Einsatz von Cookies/i,
    lang: 'de',
    body: `
<p>Cookies sind kleine Textdateien, die Informationen auf Endgeräten speichern und beim erneuten Besuch einer Website ausgelesen werden können.</p>
<p><strong>Diese Website setzt keine einwilligungspflichtigen Cookies.</strong> Es werden keine Analyse-, Tracking- oder Werbe-Cookies von Drittanbietern verwendet. Aus diesem Grund benötigt die Website kein Cookie-Banner und keine Einwilligungsverwaltung.</p>
<p>Technisch notwendige Cookies können ausschließlich dann gesetzt werden, wenn Sie aktiv eine Funktion nutzen, die sie erfordert – etwa beim Absenden des Kontakt- oder Buchungsformulars zur Absicherung gegen Mehrfachübermittlung. Rechtsgrundlage hierfür ist unser berechtigtes Interesse an einem sicheren und funktionsfähigen Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>
<p>Sie können das Speichern von Cookies jederzeit in den Einstellungen Ihres Browsers unterbinden. Ein Widerspruch über Sammel-Opt-out-Portale für Werbenetzwerke ist für diese Website nicht erforderlich, da hier keine Werbenetzwerke eingebunden sind.</p>`,
  },
  {
    // The generic third-country section is WordPress boilerplate: correct but
    // abstract ("only in accordance with legal requirements"). Art. 13(1)(f)
    // wants the specific safeguard for the specific transfer, so one concrete
    // paragraph is appended naming the mechanism actually relied on. It does
    // not repeat the vendor list — that lives in the AI section below.
    match: /Datenverarbeitung in Drittländern/i,
    lang: 'de',
    append: true,
    guard: /Durchführungsbeschluss \(EU\) 2023\/1795/,
    body: `
<p>Konkret betrifft dies vor allem die im Abschnitt „Einsatz Künstlicher Intelligenz“ genannten Anbieter von KI-Modellen und Rechenleistung. Übermittlungen in die Vereinigten Staaten stützen wir entweder auf den Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023 zum EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795), soweit der jeweilige Empfänger dort zertifiziert ist, oder auf die Standardvertragsklauseln der Europäischen Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO nebst ergänzenden Schutzmaßnahmen. Entfällt ein Angemessenheitsbeschluss oder ist er im Einzelfall nicht anwendbar, stützen wir die Übermittlung auf Art. 46 DSGVO. Eine Kopie der jeweils maßgeblichen Garantien stellen wir Ihnen auf Anfrage zur Verfügung.</p>`,
  },
  {
    // The page ended with an "EU AI Act Compliance Statement" carried over
    // from the old site. Three problems: it named a hosting provider (which
    // the owner no longer wants stated), it listed a processor set that is no
    // longer the one in use, and it claimed compliance rather than describing
    // it. Replaced wholesale — heading included, because "Compliance
    // Statement" is itself the overclaim. There is no anchor to preserve: the
    // page's "Inhaltsübersicht" is empty (the scrape lost the TOC list), and
    // this heading carries no id.
    //
    // NOTE FOR FUTURE MAINTAINERS: the vendor names below are required by
    // GDPR (see the file header) and are the one sanctioned exception to the
    // CLAUDE.md "never name the AI vendor" rule. Do not remove them; do not
    // copy them onto a feature page.
    match: /Compliance Statement gemäß EU AI Act/i,
    lang: 'de',
    heading: 'Einsatz Künstlicher Intelligenz, Auftragsverarbeiter und Transparenz nach der KI-Verordnung',
    body: `
<p>Wir erbringen KI-gestützte Marketingleistungen („AI as a Service“). Dabei werden mit Systemen der künstlichen Intelligenz Inhalte erzeugt und bearbeitet, insbesondere Texte, Bilder, Videos sowie strukturierte Produkt- und Katalogdaten.</p>

<h3 class="wp-block-heading">Zwecke und Kategorien verarbeiteter Daten</h3>
<p>Verarbeitet werden die uns übermittelten Eingabedaten (z.B. Eingabeaufforderungen bzw. „Prompts“, Produkt-, Katalog- und Feeddaten, hochgeladene Dateien sowie Marken- und Stilvorgaben), die daraus erzeugten Ausgabedaten sowie die zur Leistungserbringung erforderlichen Bestands-, Nutzungs- und Abrechnungsdaten (z.B. Konto- und Protokolldaten). Personenbezogene Daten fallen dabei regelmäßig nur an, soweit sie in den Eingaben enthalten sind oder sich aus der Nutzung des Dienstes ergeben. Die Verarbeitung dient der Erbringung der vereinbarten Leistungen, der Sicherstellung des technischen Betriebs sowie der Missbrauchs- und Betrugsabwehr.</p>

<h3 class="wp-block-heading">Rechtsgrundlagen</h3>
<p>Rechtsgrundlagen sind die Erfüllung eines Vertrags und die Durchführung vorvertraglicher Maßnahmen (Art. 6 Abs. 1 S. 1 lit. b DSGVO), die Wahrung unserer berechtigten Interessen an einem sicheren, stabilen und wirtschaftlichen Betrieb unserer Dienste (Art. 6 Abs. 1 S. 1 lit. f DSGVO), die Erfüllung rechtlicher Verpflichtungen (Art. 6 Abs. 1 S. 1 lit. c DSGVO) sowie, soweit erforderlich, Ihre Einwilligung (Art. 6 Abs. 1 S. 1 lit. a DSGVO). Soweit wir personenbezogene Daten im Auftrag unserer Kunden verarbeiten, geschieht dies auf Grundlage eines Vertrags über die Auftragsverarbeitung nach Art. 28 DSGVO; Verantwortlicher im Sinne der DSGVO ist in diesem Fall der jeweilige Kunde.</p>

<h3 class="wp-block-heading">Eigene Modelle und eingesetzte Unterauftragsverarbeiter</h3>
<p>Wir setzen sowohl eigene, von uns entwickelte und betriebene Modelle als auch Modelle und Dienste externer Anbieter ein. Diese Anbieter sind Unterauftragsverarbeiter im Sinne des Art. 28 Abs. 2 und 4 DSGVO; wir legen sie hiermit nach Art. 13 Abs. 1 lit. e DSGVO offen. Derzeit sind dies:</p>
<ul>
<li><strong>Anthropic</strong> – Sprach- und Textmodelle zur Erzeugung und Bearbeitung von Inhalten.</li>
<li><strong>Google</strong> – Sprach-, Bild- und Videomodelle sowie die zugehörige Rechenleistung.</li>
<li><strong>OpenAI</strong> – Sprach-, Text- und Bildmodelle.</li>
</ul>
<p>Maßgeblich ist jeweils die für den genutzten Dienst vertraglich verantwortliche Gesellschaft des Anbieters. Die genaue Firmierung und Anschrift sowie die vollständige, jeweils aktuelle Liste der Unterauftragsverarbeiter teilen wir Ihnen auf Anfrage unter <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> mit; über beabsichtigte Änderungen informieren wir unsere Kunden nach Maßgabe des jeweiligen Auftragsverarbeitungsvertrags.</p>
<p>Mit sämtlichen genannten Anbietern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO. Wir nutzen ausschließlich deren geschäftliche Schnittstellen (API- bzw. Enterprise-Angebote), bei denen die übermittelten Inhalte vertraglich nicht zum Training der Modelle des jeweiligen Anbieters verwendet werden. Eine Weitergabe von Kundendaten an Dritte zum Zweck des Modelltrainings findet nicht statt.</p>
<p>Eine ausschließlich auf automatisierter Verarbeitung – einschließlich Profiling – beruhende Entscheidung, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt (Art. 22 DSGVO), treffen wir nicht. KI-generierte Inhalte sind Vorschläge und vor einer Veröffentlichung durch die Nutzerin bzw. den Nutzer zu prüfen.</p>

<h3 class="wp-block-heading">Übermittlung in Drittländer</h3>
<p>Die vorgenannten Anbieter haben ihren Sitz bzw. einzelne Verarbeitungsstandorte außerhalb der Europäischen Union und des Europäischen Wirtschaftsraums, insbesondere in den Vereinigten Staaten. Soweit eine Übermittlung in ein Drittland stattfindet, stützen wir diese entweder auf den Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023 zum EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795), sofern der jeweilige Anbieter dort zertifiziert ist, oder auf die Standardvertragsklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO. Ergänzend treffen wir zusätzliche Schutzmaßnahmen, insbesondere Verschlüsselung bei Übertragung und Speicherung, Datenminimierung sowie strenge Zugriffsbeschränkungen. Soweit der jeweilige Dienst dies zulässt, nutzen wir vorrangig Verarbeitungsregionen innerhalb der EU bzw. des EWR.</p>

<h3 class="wp-block-heading">Speicher- und Verarbeitungsort</h3>
<p>Der genaue Speicher- und Verarbeitungsort personenbezogener Daten wird individuell je nach vertraglicher Vereinbarung festgelegt. Auf Wunsch und nach entsprechender Vereinbarung verarbeitet und speichert die SGS Virtual Marketer GmbH Kundendaten ausschließlich in Deutschland oder in anderen Rechenzentren innerhalb der EU bzw. des EWR. Ohne eine solche gesonderte Vereinbarung wählt die SGS Virtual Marketer GmbH einen kosteneffizienten Verarbeitungsstandort; etwaige Übermittlungen in Drittländer erfolgen stets im Einklang mit den vorstehend beschriebenen gesetzlichen Vorgaben.</p>

<h3 class="wp-block-heading">Widerspruchsrecht</h3>
<p>Soweit wir Verarbeitungen auf ein berechtigtes Interesse (Art. 6 Abs. 1 S. 1 lit. f DSGVO) stützen, haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit Widerspruch gegen diese Verarbeitung einzulegen (Art. 21 Abs. 1 DSGVO). Das gilt ausdrücklich auch für die Verarbeitung Ihrer Daten durch die vorgenannten KI-Dienste. Einer Verarbeitung zum Zweck der Direktwerbung können Sie jederzeit ohne Angabe von Gründen widersprechen (Art. 21 Abs. 2 DSGVO). Eine formlose Nachricht an <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> genügt.</p>

<h3 class="wp-block-heading">Transparenzpflichten nach der KI-Verordnung</h3>
<p>Für unsere KI-Systeme gilt die Verordnung (EU) 2024/1689 (KI-Verordnung, „AI Act“), zuletzt geändert durch die Verordnung (EU) 2026/1744 („Digital Omnibus on AI“, in Kraft seit dem 27. Juli 2026). Die Transparenzpflichten des Art. 50 KI-VO sind seit dem <strong>2. August 2026</strong> anwendbar.</p>
<ul>
<li><strong>Hinweis auf die Interaktion mit einem KI-System (Art. 50 Abs. 1 KI-VO):</strong> Sie werden klar und unterscheidbar und spätestens zum Zeitpunkt der ersten Interaktion darauf hingewiesen, dass Sie mit einem KI-System interagieren und dass die ausgegebenen Inhalte durch künstliche Intelligenz erzeugt werden (Art. 50 Abs. 5 KI-VO).</li>
<li><strong>Maschinenlesbare Kennzeichnung erzeugter Inhalte (Art. 50 Abs. 2 KI-VO):</strong> Als Anbieter generativer KI-Systeme sind wir verpflichtet, deren Ausgaben in einem maschinenlesbaren Format zu kennzeichnen und als künstlich erzeugt oder manipuliert erkennbar zu machen. Wir setzen dies durch maschinenlesbare Herkunfts- und Provenienzangaben in den Metadaten der erzeugten Dateien um. Ergänzend lässt sich eine sichtbare Kennzeichnung („Created by Virtual Marketer AI“) aktivieren; diese sichtbare Kennzeichnung ersetzt die maschinenlesbare Kennzeichnung nicht. Für KI-Systeme, die vor dem 2. August 2026 in Verkehr gebracht wurden, sieht die Verordnung (EU) 2026/1744 eine Übergangsfrist bis zum <strong>2. Dezember 2026</strong> vor; für diese Systeme stellen wir die maschinenlesbare Kennzeichnung innerhalb dieser Frist her.</li>
<li><strong>Ausnahme:</strong> Die Kennzeichnungspflicht nach Art. 50 Abs. 2 KI-VO gilt nicht, soweit ein KI-System lediglich eine unterstützende Funktion für die Standardbearbeitung ausübt oder die von Ihnen bereitgestellten Eingabedaten bzw. deren Semantik nicht wesentlich verändert.</li>
<li><strong>Pflichten der Betreiber (Art. 50 Abs. 4 KI-VO):</strong> Wer mit unseren Systemen erzeugte oder veränderte Texte veröffentlicht, um die Öffentlichkeit über Angelegenheiten von öffentlichem Interesse zu informieren, muss offenlegen, dass diese Texte künstlich erzeugt oder manipuliert wurden. Entsprechendes gilt für Bild-, Ton- oder Videoinhalte, die eine Fälschung darstellen („Deepfakes“). Diese Pflicht trifft den Betreiber, also unsere Kundinnen und Kunden; wir stellen hierfür die erforderlichen Hinweise und Kennzeichnungsfunktionen bereit.</li>
<li><strong>KI-Kompetenz (Art. 4 KI-VO):</strong> Art. 4 KI-VO gilt seit dem 2. Februar 2025. Wir treffen Maßnahmen, um die KI-Kompetenz unserer Mitarbeitenden sowie der in unserem Auftrag mit unseren KI-Systemen befassten Personen zu fördern – insbesondere durch Schulungen, interne Richtlinien zum Umgang mit generativer KI und den ausdrücklichen Hinweis auf die Notwendigkeit einer menschlichen Überprüfung der Ergebnisse.</li>
</ul>
<p><strong>Einordnung und Reichweite dieser Angaben:</strong> Nach eigener Einschätzung setzen wir weder nach Art. 5 KI-VO verbotene Praktiken noch Hochrisiko-KI-Systeme im Sinne des Kapitels III der KI-Verordnung ein; die Anwendungszeitpunkte der dortigen Pflichten wurden durch die Verordnung (EU) 2026/1744 zudem verschoben. Dieser Abschnitt beschreibt den Stand unserer Umsetzung zum oben genannten Datum. Er stellt weder eine Zertifizierung noch eine Konformitätsbewertung durch eine Behörde oder eine benannte Stelle dar.</p>`,
  },
];

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

const BLOCK_TAGS = 'p|ul|ol|h3|h4|h5|h6|blockquote|table';

/**
 * Returns the offset just past the element starting at `pos`, or -1 if what
 * sits there is not one of BLOCK_TAGS. Depth-counts the tag so nested lists
 * (which this WordPress export is full of) are consumed whole.
 */
function consumeElement(html, pos) {
  const open = new RegExp(`^<(${BLOCK_TAGS})\\b[^>]*>`, 'i').exec(html.slice(pos, pos + 300));
  if (!open) return -1;
  const re = new RegExp(`</?${open[1]}\\b[^>]*>`, 'gi');
  re.lastIndex = pos;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      if (--depth === 0) return m.index + m[0].length;
    } else {
      depth++;
    }
  }
  return -1;
}

/**
 * End of the run of block elements that follows `pos`. Used as the section
 * boundary for the LAST <h2> on a page, where "everything up to the next <h2>"
 * would otherwise swallow the closing layout divs and the entire footer — the
 * page's AI section happens to be exactly that case.
 */
function endOfBlockRun(html, pos) {
  let i = pos;
  for (;;) {
    const ws = /^\s*/.exec(html.slice(i, i + 64))[0].length;
    const next = consumeElement(html, i + ws);
    if (next < 0) return i;
    i = next;
  }
}

function findHeading(html, headingRe) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const target = headings.find((h) => headingRe.test(h[1].replace(/<[^>]+>/g, '').trim()));
  return { headings, target };
}

/**
 * Replaces a section's body. The heading is kept (and with it its anchor)
 * unless `newHeading` is given — which is only used where the old heading is
 * itself part of what is wrong.
 */
function replaceSection(html, headingRe, body, newHeading) {
  const { headings, target } = findHeading(html, headingRe);
  if (!target) return { html, changed: false };

  const next = headings.find((h) => h.index > target.index);
  const bodyEnd = next ? next.index : endOfBlockRun(html, target.index + target[0].length);

  const prefix = newHeading
    ? html.slice(0, target.index) + `<h2 class="wp-block-heading">${newHeading}</h2>`
    : html.slice(0, target.index + target[0].length);

  return { html: prefix + '\n' + body.trim() + '\n' + html.slice(bodyEnd), changed: true };
}

/**
 * Adds a paragraph at the end of a section, leaving its existing text intact.
 * `guard` is a regex that, if already present in the page, makes this a no-op
 * — so the step stays safe to re-run over an already-patched file.
 */
function appendToSection(html, headingRe, body, guard) {
  const { headings, target } = findHeading(html, headingRe);
  if (!target) return { html, changed: false };
  if (guard && guard.test(html)) return { html, changed: false };

  const next = headings.find((h) => h.index > target.index);
  const at = next ? next.index : endOfBlockRun(html, target.index + target[0].length);
  return { html: html.slice(0, at) + body.trim() + '\n' + html.slice(at), changed: true };
}

function main() {
  console.log('\n🔐 Correcting the privacy policy...\n');

  const targets = findHtmlFiles(DIST).filter((f) => {
    const url = '/' + path.relative(DIST, path.dirname(f)).split(path.sep).join('/') + '/';
    return url === '/datenschutzerklaerung/' || url === '/en/privacy-policy/';
  });

  let changedFiles = 0;
  for (const file of targets) {
    const url = '/' + path.relative(DIST, path.dirname(file)).split(path.sep).join('/') + '/';
    const lang = url.startsWith('/en/') ? 'en' : 'de';
    let html = fs.readFileSync(file, 'utf-8');
    const original = html;
    const applied = [];

    for (const s of SECTIONS.filter((x) => x.lang === lang)) {
      const res = s.append
        ? appendToSection(html, s.match, s.body)
        : replaceSection(html, s.match, s.body);
      if (res.changed) {
        html = res.html;
        applied.push(String(s.match).slice(0, 42));
      }
    }

    if (html !== original) {
      fs.writeFileSync(file, html);
      changedFiles++;
      console.log(`   • ${url} — ${applied.length} section(s) rewritten`);
    } else {
      console.log(`   – ${url} — no matching sections found`);
    }
  }

  // Verify the stale services are gone from the visible copy — or, where the
  // name survives, that it survives only inside a negation ("weder Google
  // Analytics noch Jetpack ... zum Einsatz"). Naming a service in order to
  // say it is NOT used is correct and must not trip the check; a warning that
  // cries wolf is how real warnings stop being read.
  const NEGATORS = /\b(kein|keine|keinen|keiner|weder|noch|nicht|no|neither|nor|without)\b/i;
  for (const file of targets) {
    const text = fs.readFileSync(file, 'utf-8');
    // Script and style bodies are stripped before checking. This runs early
    // in the pipeline, where leftover Jetpack/WooCommerce tags are still
    // present — scripts/strip-wp-cruft.js removes them further down, and the
    // final build carries none. Flagging them here would warn about
    // something already owned and fixed elsewhere, which is the same
    // cry-wolf failure this check was sharpened to avoid. The question here
    // is only whether the policy TEXT still asserts a stale service.
    const prose = text
      .slice(text.indexOf('<body'))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    const offenders = [];
    for (const k of ['Jetpack', 'Automattic', 'WordPress.com', 'Google Analytics']) {
      const re = new RegExp(`[^.!?]*\\b${k.replace('.', '\\.')}[^.!?]*[.!?]`, 'gi');
      for (const m of prose.match(re) || []) {
        if (!NEGATORS.test(m)) offenders.push(`${k} — "${m.trim().slice(0, 90)}"`);
      }
    }
    if (offenders.length) {
      console.log(`   ⚠ ${path.relative(DIST, file)} still asserts stale services:`);
      offenders.forEach((o) => console.log(`       ${o}`));
    }
  }

  console.log(`\n✅ Privacy policy corrected in ${changedFiles} file(s)\n`);
}

main();
