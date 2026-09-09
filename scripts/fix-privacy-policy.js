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
 * So: the infrastructure and AI providers below are named in
 * /datenschutzerklaerung/ and
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
const STAND = '9. September 2026';

/**
 * The sub-processors, disclosed per Art. 13(1)(e) / Art. 28 GDPR. Single
 * source of truth so the German and English pages cannot drift, and so the
 * marketing-tree leak check below knows exactly what to look for.
 *
 * Split into two groups because they answer different questions. Art. 13(1)(e)
 * is about who receives the data; a reader cannot judge that from a flat list
 * in which "Google" might mean a model API or a data centre. Infrastructure
 * providers hold data at rest, model providers see it in transit — the
 * distinction is what makes the third-country paragraph below readable.
 *
 * Confirmed in use by the operator (2026-08-04). STRATO is a German company,
 * which is why the third-country wording says "some of" and not "the".
 */
const INFRA_SUBPROCESSORS = ['STRATO', 'Microsoft Azure', 'Google Cloud'];
const AI_SUBPROCESSORS = ['Anthropic', 'Google', 'OpenAI', 'Hugging Face'];

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
<p>Wir setzen sowohl eigene, von uns entwickelte und betriebene Modelle als auch Infrastruktur, Modelle und Dienste externer Anbieter ein. Diese Anbieter sind Unterauftragsverarbeiter im Sinne des Art. 28 Abs. 2 und 4 DSGVO; wir legen sie hiermit nach Art. 13 Abs. 1 lit. e DSGVO offen. Derzeit sind dies:</p>
<p><strong>Infrastruktur, Hosting und Betrieb</strong></p>
<ul>
<li><strong>STRATO AG</strong>, Berlin (Deutschland) – Server-, Speicher- und E-Mail-Infrastruktur.</li>
<li><strong>Microsoft Azure</strong> – Cloud-Infrastruktur, Speicher und Rechenleistung.</li>
<li><strong>Google Cloud</strong> – Cloud-Infrastruktur, Speicher und Rechenleistung.</li>
</ul>
<p><strong>KI-Modelle und KI-Dienste</strong></p>
<ul>
<li><strong>Anthropic</strong> – Sprach- und Textmodelle zur Erzeugung und Bearbeitung von Inhalten.</li>
<li><strong>Google</strong> – Sprach-, Bild- und Videomodelle sowie die zugehörige Rechenleistung.</li>
<li><strong>OpenAI</strong> – Sprach-, Text- und Bildmodelle.</li>
<li><strong>Hugging Face</strong> – Bereitstellung und Ausführung offener Modelle (Modell-Hosting und Inferenz).</li>
</ul>
<p>Maßgeblich ist jeweils die für den genutzten Dienst vertraglich verantwortliche Gesellschaft des Anbieters. Die genaue Firmierung und Anschrift sowie die vollständige, jeweils aktuelle Liste der Unterauftragsverarbeiter teilen wir Ihnen auf Anfrage unter <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> mit; über beabsichtigte Änderungen informieren wir unsere Kunden nach Maßgabe des jeweiligen Auftragsverarbeitungsvertrags.</p>
<p>Mit sämtlichen genannten Anbietern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO. Bei den KI-Diensten nutzen wir ausschließlich deren geschäftliche Schnittstellen (API- bzw. Enterprise-Angebote), bei denen die übermittelten Inhalte vertraglich nicht zum Training der Modelle des jeweiligen Anbieters verwendet werden.</p>
<p><strong>Auch wir selbst verwenden Kundendaten nicht zum Training von Modellen für andere Kunden.</strong> Inhalte, die uns eine Kundin oder ein Kunde zur Verarbeitung übermittelt, verarbeiten wir ausschließlich für diese Kundin bzw. diesen Kunden. Sie fließen weder in das Training oder die Nachjustierung („Feintuning“) unserer eigenen Modelle für andere Kundinnen und Kunden noch in mandantenübergreifende Auswertungen ein. Eine Weitergabe von Kundendaten an Dritte zum Zweck des Modelltrainings findet nicht statt.</p>
<p>Eine ausschließlich auf automatisierter Verarbeitung – einschließlich Profiling – beruhende Entscheidung, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt (Art. 22 DSGVO), treffen wir nicht. KI-generierte Inhalte sind Vorschläge und vor einer Veröffentlichung durch die Nutzerin bzw. den Nutzer zu prüfen.</p>

<h3 class="wp-block-heading">Übermittlung in Drittländer</h3>
<p>Ein Teil der vorgenannten Anbieter hat seinen Sitz bzw. einzelne Verarbeitungsstandorte außerhalb der Europäischen Union und des Europäischen Wirtschaftsraums, insbesondere in den Vereinigten Staaten. Die STRATO AG ist ein deutsches Unternehmen und betreibt ihre Rechenzentren in Deutschland; die Cloud-Angebote von Microsoft Azure und Google Cloud nutzen wir, soweit der jeweilige Dienst dies zulässt, in europäischen Regionen. Soweit eine Übermittlung in ein Drittland stattfindet, stützen wir diese entweder auf den Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023 zum EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795), sofern der jeweilige Anbieter dort zertifiziert ist, oder auf die Standardvertragsklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO. Ergänzend treffen wir zusätzliche Schutzmaßnahmen, insbesondere Verschlüsselung bei Übertragung und Speicherung, Datenminimierung sowie strenge Zugriffsbeschränkungen. Soweit der jeweilige Dienst dies zulässt, nutzen wir vorrangig Verarbeitungsregionen innerhalb der EU bzw. des EWR.</p>

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
  {
    // Order matters: this append must come BEFORE the app section below, which
    // also carries the deletion URL. The guard is therefore this paragraph's
    // own opening clause and not the URL — a URL guard would make whichever
    // append ran second a silent no-op.
    //
    // "Löschung von Daten" is where a reader looks for this, and until
    // 2026-09-09 the section said only that data is deleted "nach Maßgabe der
    // gesetzlichen Vorgaben" — true, and useless to someone who wants to press
    // a button. Google Play additionally requires a deletion URL reachable
    // without installing the app; that requirement and this paragraph are the
    // same sentence.
    match: /^Löschung von Daten$/i,
    lang: 'de',
    append: true,
    guard: /Konto- und Mandantendaten der Plattform können Sie selbst löschen/,
    body: `
<p class="wp-block-paragraph"><strong>Konto- und Mandantendaten der Plattform können Sie selbst löschen.</strong> Der Löschvorgang ist ohne Installation einer App unter <a href="https://login.virtual-marketer.de/konto-loeschen">https://login.virtual-marketer.de/konto-loeschen</a> erreichbar. Was dabei jeweils entfernt wird – und warum die Konversationsprotokolle nur zusammen mit dem Unternehmenskonto gelöscht werden können – ist im Abschnitt „Virtual Marketer App für Android (Mikrofon, Kamera, Sprachmodus)“ beschrieben.</p>`,
  },
  {
    // WHY THIS SECTION EXISTS
    //
    // The Android app declares RECORD_AUDIO. A privacy policy that never
    // mentions voice, linked from a Play data-safety form that declares
    // "Audio → Voice or sound recordings", is a mismatch reviewers check for
    // and one of the more common reasons a first submission is rejected. It is
    // also simply a gap: Art. 13 DSGVO does not have an exception for the
    // features that are inconvenient to describe.
    //
    // Every factual claim below was established by reading the code on
    // 2026-09-07 (audit in vm-mobile/docs/play-store/data-safety.md §1.2-1.4).
    // In particular the two asymmetries are stated rather than smoothed over,
    // because both are real and neither is visible to the user:
    //   - audio is NOT retained by us, but the WORDS are, indefinitely;
    //   - the turn-by-turn mode writes a conversation record and the
    //     continuously-connected one writes none at all.
    //
    // It is appended as a NEW <h2> after the AI section, which is the last
    // heading on the page — appendToSection's endOfBlockRun boundary is what
    // makes that land before the footer rather than inside it.
    //
    // The modes are described by what they do ("Wechselsprechverfahren",
    // "durchgehend verbundenes Verfahren") and the model providers are
    // referenced through the list in the AI section rather than picked out
    // individually. That is not the branding rule leaking into a legal page —
    // the sub-processors ARE named, one section up, which is what Art. 13(1)(e)
    // requires. It is that naming one of them here would assert a routing
    // detail this text cannot keep true across a provider change.
    match: /Einsatz Künstlicher Intelligenz/i,
    lang: 'de',
    append: true,
    guard: /Sprachmodus: Verarbeitung von Mikrofonaufnahmen/,
    body: `
<h2 class="wp-block-heading">Virtual Marketer App für Android (Mikrofon, Kamera, Sprachmodus)</h2>
<p class="wp-block-paragraph">Neben der Weboberfläche bieten wir eine App für Android an. Sie ist ein Zugang zu derselben Plattform und zu denselben Konten; eine Registrierung findet in der App nicht statt, Konten werden von uns eingerichtet. Für die Verarbeitung in der App gelten die vorstehenden Abschnitte, insbesondere „Einsatz Künstlicher Intelligenz, Auftragsverarbeiter und Transparenz nach der KI-Verordnung“. Ergänzend gilt Folgendes.</p>

<h3 class="wp-block-heading">Berechtigungen und Daten auf dem Gerät</h3>
<p class="wp-block-paragraph">Die App fordert zwei Geräteberechtigungen an, und zwar erst dann, wenn Sie die zugehörige Funktion tatsächlich benutzen:</p>
<ul>
<li><strong>Mikrofon</strong> – ausschließlich für den Sprachmodus. Außerhalb des Sprachmodus wird das Mikrofon nicht aktiviert.</li>
<li><strong>Kamera bzw. Auswahl einzelner Dateien</strong> – ausschließlich, um einer Nachricht an einen Agenten ein Foto, ein Bild aus der Galerie, ein PDF oder eine Textdatei beizufügen. Die App durchsucht weder Ihre Galerie noch Ihren Gerätespeicher; übertragen wird nur, was Sie im Auswahldialog des Betriebssystems selbst auswählen.</li>
</ul>
<p class="wp-block-paragraph">Nicht verarbeitet werden Standortdaten, Kontakte, Kalender, SMS- und Anrufdaten sowie Geräte- und Werbekennungen. Die App bindet <strong>keine Analyse-, Absturzberichts- oder Werbe-Bibliotheken</strong> ein; es findet weder Reichweitenmessung noch Tracking statt.</p>
<p class="wp-block-paragraph">Ihre Zugangsdaten – das Sitzungstoken und der Schlüssel Ihres Mandanten – werden verschlüsselt im Schlüsselspeicher des Betriebssystems abgelegt und beim Abmelden gelöscht. Die Übertragung zu unseren Servern erfolgt ausschließlich transportverschlüsselt.</p>

<h3 class="wp-block-heading">Sprachmodus: Verarbeitung von Mikrofonaufnahmen</h3>
<p class="wp-block-paragraph">Im Sprachmodus sprechen Sie mit einem Agenten und erhalten eine gesprochene Antwort. Solange der Sprachmodus läuft, wird das Mikrofon aufgezeichnet. Welches von zwei technischen Verfahren dabei zum Einsatz kommt, hängt von der für Ihr Konto freigeschalteten Ausbaustufe ab: ein <strong>Wechselsprechverfahren</strong>, das jeden Redebeitrag einzeln aufnimmt, und ein <strong>durchgehend verbundenes Verfahren</strong>, bei dem in beide Richtungen gleichzeitig übertragen wird.</p>
<p class="wp-block-paragraph"><strong>Übermittlung an einen Unterauftragsverarbeiter.</strong> In beiden Verfahren werden die Audiodaten an unsere Server übertragen und von dort unverändert an einen der im Abschnitt „Einsatz Künstlicher Intelligenz …“ genannten Anbieter von KI-Modellen weitergeleitet, der Spracherkennung und Sprachausgabe übernimmt. Es gelten die dort beschriebenen Verträge zur Auftragsverarbeitung, die dort genannten Garantien für Drittlandübermittlungen sowie der dort beschriebene vertragliche Ausschluss einer Verwendung zu Trainingszwecken.</p>
<p class="wp-block-paragraph"><strong>Die Audiodaten werden bei uns nicht gespeichert.</strong> Sie durchlaufen unsere Server ausschließlich im Arbeitsspeicher; eine Speicherung in Dateien, Objektspeichern oder Datenbanken findet nicht statt, und Audioinhalte werden nicht protokolliert. Auch die gesprochene Antwort des Agenten wird auf Ihrem Gerät nur abgespielt und nicht gespeichert.</p>
<p class="wp-block-paragraph"><strong>Auf dem Gerät</strong> legt das Wechselsprechverfahren jeden Redebeitrag kurzzeitig als Datei im app-privaten Zwischenspeicher ab, weil das Betriebssystem nur auf diesem Weg aufzeichnet. Die App löscht diese Datei unmittelbar nach dem Auslesen; für andere Apps ist sie zu keinem Zeitpunkt lesbar. Im durchgehend verbundenen Verfahren entsteht überhaupt keine Datei – die Audiodaten gehen unmittelbar aus dem Mikrofon auf die Verbindung.</p>
<p class="wp-block-paragraph"><strong>Nicht die Aufnahme, aber das gesprochene Wort wird gespeichert.</strong> Im Wechselsprechverfahren wird Ihr Redebeitrag in Text umgewandelt, und dieser Text ist die Nachricht, die der Agent erhält. Er wird deshalb – wie jede getippte Nachricht – Teil des Konversationsprotokolls und dort gespeichert. Im durchgehend verbundenen Verfahren wird dagegen <strong>kein Konversationsprotokoll angelegt</strong>; das Transkript verbleibt dort nur für die Dauer des jeweiligen Gesprächsabschnitts im Arbeitsspeicher. Dieser Unterschied ist am Bildschirm nicht erkennbar; welches Verfahren für Ihr Konto freigeschaltet ist, teilen wir Ihnen auf Anfrage unter <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> mit.</p>

<h3 class="wp-block-heading">Kamera und Anhänge</h3>
<p class="wp-block-paragraph">Fügen Sie einer Nachricht ein Foto, ein Bild, ein PDF oder eine Textdatei bei, wird der Inhalt der Datei an den Agenten und damit an den KI-Anbieter übermittelt. <strong>Den Inhalt speichern wir nicht</strong>; er wird im Arbeitsspeicher verarbeitet und ist nach der Antwort nicht mehr vorhanden. <strong>Gespeichert werden jedoch Dateiname, Dateityp und Dateigröße</strong> als Teil des Konversationsprotokolls, damit dieses nicht verschweigt, dass eine Datei im Spiel war. Bitte beachten Sie, dass bereits ein Dateiname personenbezogene Daten enthalten kann.</p>

<h3 class="wp-block-heading">Konversationsprotokolle und Speicherdauer</h3>
<p class="wp-block-paragraph">Zu jedem Auftrag an einen Agenten – aus dem Chat, über einen Webhook oder aus einer Zeitplanung – speichern wir ein Protokoll. Es enthält Ihre Nachricht im Volltext (bis zu 8.000 Zeichen), die vollständige Antwort des Agenten, die Kennungen des Mandanten und der Agenteninstanz, Auslöser, Status und Zeitstempel, die Metadaten beigefügter Dateien sowie zu jedem Werkzeugaufruf des Agenten dessen Namen und einen <strong>auf 200 Zeichen gekürzten Auszug der übergebenen Parameter</strong>. Dieser Auszug kann Inhalte enthalten, die der Agent an ein angebundenes System – etwa ein CRM- oder Warenwirtschaftssystem – übergeben hat.</p>
<p class="wp-block-paragraph">Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 S. 1 lit. b DSGVO) sowie unser berechtigtes Interesse an der Nachvollziehbarkeit automatisierter Abläufe und an der Fehlersuche (Art. 6 Abs. 1 S. 1 lit. f DSGVO).</p>
<p class="wp-block-paragraph"><strong>Für diese Protokolle besteht derzeit keine automatische Löschfrist.</strong> Sie werden auf unbestimmte Zeit gespeichert, bis sie auf Anforderung oder mit der Löschung des Unternehmenskontos entfernt werden. Wir benennen das hier ausdrücklich, statt eine Frist zu behaupten, die es nicht gibt. Die Protokolle sind dem Mandanten – dem Unternehmenskonto – zugeordnet und nicht der einzelnen Person; innerhalb eines Teams sind sie deshalb für alle Mitglieder dieses Mandanten einsehbar und lassen sich nicht nach einzelnen Teammitgliedern getrennt löschen.</p>

<h3 class="wp-block-heading">Löschung Ihres Kontos</h3>
<p class="wp-block-paragraph">Sie können Ihr Konto selbst löschen, ohne dafür eine App zu installieren, unter <a href="https://login.virtual-marketer.de/konto-loeschen">https://login.virtual-marketer.de/konto-loeschen</a>. Dabei ist zu unterscheiden:</p>
<ul>
<li><strong>Löschung des Benutzerkontos.</strong> Entfernt Ihr persönliches Konto mit Vor- und Nachname, E-Mail-Adresse, Passwort-Hash, Zwei-Faktor-Geheimnis, Profilbild, Nutzungsstatistik und den in Ihrem Konto hinterlegten Zugangsdaten für den Postfachversand. Gehören weitere Personen zu demselben Unternehmenskonto, bleiben dessen gemeinsame Daten – darunter die Konversationsprotokolle – bestehen: sie gehören nicht Ihnen allein, und eine einzelne Person soll die Daten ihrer Kolleginnen und Kollegen nicht mit löschen können.</li>
<li><strong>Löschung des gesamten Unternehmenskontos.</strong> Entfernt zusätzlich sämtliche mandantenbezogenen Daten, insbesondere alle Konversationsprotokolle, die Agenteninstanzen samt der dort hinterlegten Zugangsdaten zu Drittsystemen und die gespeicherten Stimmprofile. Diese Löschung steht Administratorinnen und Administratoren des Unternehmenskontos offen sowie jeder Person, die als letztes verbliebenes Mitglied ihres Mandanten ihr Konto löscht. Sie ist die einzige Löschung, die die Konversationsprotokolle erreicht.</li>
</ul>
<p class="wp-block-paragraph">Beide Löschungen sind endgültig und werden erst nach einer ausdrücklichen Bestätigung ausgeführt: Sie müssen angemeldet sein, einen aktuellen Code Ihrer Zwei-Faktor-App eingeben und die Löschung durch Eingabe einer Bestätigungsformel freigeben. Das ist bewusst strenger als eine Anmeldung – eine Löschfunktion, die schwächer gesichert wäre als der Zugang selbst, wäre ein Weg zur Übernahme fremder Konten. <strong>Haben Sie keinen Zugriff mehr auf Ihre Zwei-Faktor-App</strong>, wenden Sie sich an <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a>: wir prüfen Ihre Identität dann auf anderem Weg und führen die Löschung für Sie aus.</p>
<p class="wp-block-paragraph">Unabhängig davon können Sie sämtliche Betroffenenrechte nach Art. 15 bis 21 DSGVO jederzeit formlos unter <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a> geltend machen. Gesetzliche Aufbewahrungspflichten, etwa aus dem Handels- und Steuerrecht, bleiben von einer Löschung unberührt; in diesem Fall werden die betroffenen Daten gesperrt statt gelöscht (siehe „Löschung von Daten“).</p>`,
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

/**
 * The "Übersicht der Verarbeitungen" bullet lists are WordPress boilerplate
 * and contradicted the rest of the page: they announced Remarketing, user
 * profiling, audience building, conversion and reach measurement as purposes
 * of processing, while four sections further down correctly state that none
 * of that happens. A privacy policy that contradicts itself in its own
 * summary is worse than one that is merely terse, so the ad-tech purposes are
 * struck and the AI purposes the company actually pursues are added.
 *
 * The export nests every bullet as
 *   <ul><li style="list-style-type: none;"><ul><li>TEXT</li></ul></li></ul>
 * followed by two empty <p>s, so the whole wrapper is matched and removed —
 * leaving an orphaned wrapper behind would show up as a stray empty bullet.
 */
const OVERVIEW_DROP = [
  'Konversionsmessung (Messung der Effektivität von Marketingmaßnahmen).',
  'Profile mit nutzerbezogenen Informationen (Erstellen von Nutzerprofilen).',
  'Remarketing.',
  'Reichweitenmessung (z.B. Zugriffsstatistiken, Erkennung wiederkehrender Besucher).',
  'Zielgruppenbildung (Bestimmung von für Marketingzwecke relevanten Zielgruppen oder sonstige Ausgabe von Inhalten).',
];

const OVERVIEW_ADD = [
  {
    after: 'Inhaltsdaten (z.B. Eingaben in Onlineformularen).',
    items: [
      'Eingabe- und Ausgabedaten unserer KI-Dienste (z.B. Eingabeaufforderungen/„Prompts“, hochgeladene Dateien, Produkt- und Katalogdaten sowie die daraus erzeugten Inhalte).',
      // The summary listed uploaded files but not the microphone. Declaring a
      // voice permission in an app store against a policy whose own overview
      // does not mention voice is the mismatch a reviewer notices first.
      'Sprachaufnahmen im Sprachmodus unserer App sowie die daraus erzeugten Transkripte.',
    ],
  },
  {
    after: 'Erbringung vertragliche Leistungen und Kundenservice.',
    items: [
      'Erbringung KI-gestützter Leistungen (Erzeugung und Bearbeitung von Texten, Bildern, Videos und Produktdaten).',
      'Spracherkennung und Sprachausgabe im Sprachmodus unserer App.',
    ],
  },
];

function bulletBlock(text) {
  return `<ul>\n<li style="list-style-type: none;">\n<ul>\n<li>${text}</li>\n</ul>\n</li>\n</ul>\n<p></p>\n<p></p>\n`;
}

function fixOverviewLists(html) {
  let out = html;
  let changed = 0;

  for (const text of OVERVIEW_DROP) {
    const block = bulletBlock(text);
    if (out.includes(block)) {
      out = out.replace(block, '');
      changed++;
    }
  }

  for (const { after, items } of OVERVIEW_ADD) {
    const anchor = bulletBlock(after);
    if (!out.includes(anchor)) continue;
    const addition = items.filter((t) => !out.includes(`<li>${t}</li>`)).map(bulletBlock).join('');
    if (!addition) continue;
    out = out.replace(anchor, anchor + addition);
    changed++;
  }

  return { html: out, changed };
}

/**
 * Disclosures the English page must carry to be equivalent to the German one.
 * The English policy is written in generate-en-pages.js and has its own,
 * shorter structure; this check exists so that "shorter" can never quietly
 * become "weaker" — the two pages have drifted before.
 */
const EN_REQUIRED = [
  ...INFRA_SUBPROCESSORS.map((v) => [`infrastructure sub-processor: ${v}`, new RegExp(`\\b${v}\\b`)]),
  ...AI_SUBPROCESSORS.map((v) => [`AI sub-processor: ${v}`, new RegExp(`\\b${v}\\b`)]),
  ['own models', /own[^.]{0,40}models/i],
  ['Art. 28 processing agreement', /Art\.?\s*28/i],
  ['no vendor training on customer data', /not\s+used\s+to\s+train/i],
  ['no own training across customers', /train[^.]{0,80}other customers/i],
  ['EU-US Data Privacy Framework', /Data Privacy Framework/i],
  ['SCCs / Art. 46', /Art\.?\s*46/i],
  ['right to object (Art. 21)', /Art\.?\s*21/i],
  ['AI Act Regulation number', /2024\/1689/],
  ['Digital Omnibus Regulation number', /2026\/1744/],
  ['Art. 50 transparency', /Art\.?\s*50/i],
  ['Art. 50 application date', /2\s+August\s+2026/i],
  ['machine-readable marking', /machine-readable/i],
  ['marking transition deadline', /2\s+December\s+2026/i],
  ['Art. 4 AI literacy', /AI literacy/i],
  ['EU hosting', /within the European Union/i],
  ['server logs not denied', /server log/i],
  // Added 2026-09-09 with the Android app section. The app declares
  // RECORD_AUDIO; a policy that is silent on voice is both a GDPR gap and the
  // mismatch a Play reviewer checks for. The German page is where the wording
  // was worked out, and these entries are what stops the English page from
  // quietly staying at the old, shorter version.
  ['Android app named', /Android/],
  ['microphone permission', /microphone/i],
  ['voice audio not stored on our servers', /not stored on our servers/i],
  ['voice transcript becomes a stored message', /transcript/i],
  ['attachment file names retained', /file name/i],
  ['conversation records kept indefinitely', /indefinitely/i],
  ['self-service deletion URL', /konto-loeschen/],
  ['deletion needs the second factor', /two-factor/i],
];

/** Marketing trees that must never carry an AI vendor name. */
const MARKETING_TREES = ['ki-loesungen', 'en/solutions', 'preise', 'en/pricing'];
const VENDOR_LEAK = /\b(Anthropic|OpenAI|Gemini|Google Cloud|Vertex AI|HuggingFace|Hugging Face|Microsoft Azure|Claude)\b/gi;

/**
 * Naming a vendor as a WIRE PROTOCOL is not what the CLAUDE.md rule forbids.
 * The Coding API's whole selling point is that it speaks the OpenAI- and
 * Anthropic-compatible request format, and there is no vendor-neutral name
 * for that format — "point your tool at an OpenAI-compatible base URL" says
 * nothing about which engine answers. What the rule forbids is disclosing the
 * engine behind Virtual Marketer Senior/Junior, so only unqualified vendor
 * mentions are flagged.
 */
const PROTOCOL_CONTEXT =
  /^[-\s]*(kompatib\w*|compatible|SDKs?|APIs?|Basis-URL|base URL|provider|Anbieter|Chat[- ]Completions|Messages|protocol|Protokoll|endpoint|Endpunkt|format|Format|Schema|Schl(ü|ue)ssel|key)\b/i;

function checkVendorLeak() {
  const offenders = [];
  for (const tree of MARKETING_TREES) {
    const dir = path.join(DIST, tree);
    if (!fs.existsSync(dir)) continue;
    for (const file of findHtmlFiles(dir)) {
      const text = fs.readFileSync(file, 'utf-8');
      const prose = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
      VENDOR_LEAK.lastIndex = 0;
      let hit;
      while ((hit = VENDOR_LEAK.exec(prose))) {
        const after = prose.slice(hit.index + hit[0].length, hit.index + hit[0].length + 40);
        if (PROTOCOL_CONTEXT.test(after)) continue;
        offenders.push(
          `${path.relative(DIST, file)} — "${prose.slice(hit.index - 30, hit.index + 50).replace(/\s+/g, ' ').trim()}"`,
        );
        break;
      }
    }
  }
  return offenders;
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
        ? appendToSection(html, s.match, s.body, s.guard)
        : replaceSection(html, s.match, s.body, s.heading);
      if (res.changed) {
        html = res.html;
        applied.push(String(s.match).slice(0, 42));
      } else {
        console.log(`   ⚠ ${url} — section not found: ${String(s.match)}`);
      }
    }

    if (lang === 'de') {
      const overview = fixOverviewLists(html);
      if (overview.changed) {
        html = overview.html;
        applied.push(`Übersicht der Verarbeitungen (${overview.changed} Listenänderungen)`);
      }

      // "Stand:" is the revision date of the policy, not the build date —
      // hardcoded on purpose so a rebuild cannot pretend the text was
      // reviewed today.
      if (/Stand: \d{1,2}\. \w+ \d{4}/.test(html)) {
        html = html.replace(/Stand: \d{1,2}\. \w+ \d{4}/g, `Stand: ${STAND}`);
        applied.push('Stand');
      }
    }

    if (html !== original) {
      fs.writeFileSync(file, html);
      changedFiles++;
      console.log(`   • ${url} — ${applied.length} section(s) rewritten`);
    } else if (SECTIONS.some((x) => x.lang === lang)) {
      console.log(`   – ${url} — no matching sections found`);
    } else {
      // The English policy is generated whole by generate-en-pages.js, so
      // there is nothing to patch here — only the parity check below.
      console.log(`   – ${url} — nothing to patch (authored in generate-en-pages.js)`);
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

  // The German page is authoritative; the English one is shorter by design.
  // "Shorter" must not silently become "says less", so every disclosure that
  // carries legal weight is checked for on the English page too.
  const enFile = targets.find((f) => f.includes(`${path.sep}en${path.sep}privacy-policy`));
  if (enFile) {
    const enText = fs.readFileSync(enFile, 'utf-8');
    const missing = EN_REQUIRED.filter(([, re]) => !re.test(enText)).map(([label]) => label);
    if (missing.length) {
      console.log('   ⚠ /en/privacy-policy/ is missing German-page disclosures:');
      [...new Set(missing)].forEach((m) => console.log(`       ${m}`));
    } else {
      console.log('   ✓ /en/privacy-policy/ carries every disclosure of the German page');
    }
  }

  // The vendor names are legally required in the privacy policy and forbidden
  // everywhere else (see the file header). Enforce the second half of that.
  const leaks = checkVendorLeak();
  if (leaks.length) {
    console.log('   ⚠ AI vendor names leaked into marketing pages:');
    leaks.forEach((l) => console.log(`       ${l}`));
  } else {
    console.log(`   ✓ no AI vendor name in ${MARKETING_TREES.join(', ')}`);
  }

  console.log(`\n✅ Privacy policy corrected in ${changedFiles} file(s)\n`);
}

main();
