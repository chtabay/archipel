// Le chemin, le glaneur — script de contenu (spike). Dans chaque cadre de chaque page (sauf celle du chemin), il regarde ce
// qu’on écrit SOI-MÊME dans les zones de texte et le confie au stockage de l’extension, sur cet ordinateur. Rien ne part :
// l’extension ne fait aucune requête réseau (sa CSP l’interdit) et ne garde, par champ, que la dernière version écrite.
//
// Ne sont jamais glanés : mots de passe (type=password, ou formulaire de connexion), cartes (autocomplete cc-*), codes à
// usage unique (one-time-code), nouveaux / anciens mots de passe (new-password / current-password), champs cachés, et tout
// champ dont le name/id/label dit card|cvv|iban|code|pin|otp|password (et quelques synonymes FR), les recherches, les
// listes de complétion, les éditeurs de code. Ce qu’on colle ou cite n’est pas de soi. En dessous de 3 mots, ce n’est pas
// un écrit : un nom, une date, un « ok ».
//
// Portée Chromium. Différences Firefox notées plus bas (globalThis.browser, pas de match_origin_as_fallback, ombres fermées
// inaccessibles). On n’écoute PAS les touches une à une (pas de keylogging) : on lit la zone entière au moment où l’écrit
// est « posé » (submit, Entrée sur une ligne, perte du focus après une modification, clic sur un bouton d’envoi, pagehide).
(() => {
  if (globalThis.__glaneurChemin) return; globalThis.__glaneurChemin = true;
  const ext = globalThis.browser ?? globalThis.chrome; // Firefox expose `browser`, Chromium `chrome`
  if (!ext?.runtime?.id) return;

  const MOTS = 3; // au moins 3 mots porteurs de sens
  // Exclusions d’attribut autocomplete (liste du cahier des charges + quelques évidences)
  const AUTOCOMPLETE = /\b(cc-[a-z-]*|one-time-code|new-password|current-password|webauthn)\b/i;
  // Exclusions de nom/id/label : card|cvv|iban|code|pin|otp|password, et synonymes FR du produit
  const NOM = /card|carte|cvv|cvc|cryptogramme|iban|\bbic\b|swift|\bcode\b|\bpin\b|\botp\b|2fa|password|mot.?de.?passe|\bmdp\b|secret|\bssn\b|s[ée]cu/i;
  // Recherches et complétions : pas des écrits de la journée
  const RECHERCHE = /search|recherche|rechercher|\bquery\b|\bq\b/i;
  const CODE = '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor, [data-glaneur="non"]'; // du code n’est pas un écrit
  const CITE = 'blockquote, .gmail_quote, .gmail_attr, [data-glaneur="non"]'; // ce qu’on cite est écrit par d’autres
  const BLOC = /^(div|p|li|h[1-6]|blockquote|pre|tr|section|article|ul|ol)$/;
  const ENVOI = /envoyer|\bsend\b|publier|poster|\bpost\b|r[ée]pondre|\breply\b|tweeter|partager|share/i; // les boutons d’envoi

  let pause = false, exclus = [];
  const lire = () => ext.storage.local.get(['pause', 'blocklist']).then(r => {
    pause = r.pause === true; exclus = Array.isArray(r.blocklist) ? r.blocklist : [];
  }).catch(() => {});
  lire(); ext.storage.onChanged?.addListener(lire);
  const bloque = () => exclus.some(h => location.hostname === h || location.hostname.endsWith(`.${h}`));
  const permis = () => !pause && !ext.extension?.inIncognitoContext && !bloque();

  const jour = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

  // Traverser les ombres, même fermées (Chromium : ext.dom.openOrClosedShadowRoot ; Firefox : indisponible → on ne voit
  // que l’élément hôte, donc rien à l’intérieur d’une ombre fermée — c’est une limite, documentée).
  const ombre = el => el.shadowRoot || ext.dom?.openOrClosedShadowRoot?.(el) || null;
  const profond = () => { let a = document.activeElement; for (;;) { const r = a && ombre(a); if (!r?.activeElement) return a; a = r.activeElement; } };
  const hote = el => { let h = el; while (h.parentElement?.isContentEditable) h = h.parentElement; return h; };
  const dit = el => [el.getAttribute('name'), el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('data-testid'), el.labels?.[0]?.textContent].filter(Boolean).join(' ');

  const visible = el => { // un champ caché ne compte pas
    if (el.type === 'hidden' || el.hidden || el.closest('[hidden]')) return false;
    const s = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
    if (s && (s.display === 'none' || s.visibility === 'hidden')) return false;
    return true;
  };

  function zone(el) { // la zone d’écriture, ou null si ce qu’on y tape ne regarde pas le chemin
    if (!el || el.nodeType !== 1) return null;
    const z = el.isContentEditable ? hote(el) : el;
    if (!(z.localName === 'textarea' || z.localName === 'input' || z.isContentEditable)) return null;
    if (!visible(z)) return null;
    const role = (z.getAttribute('role') || '').toLowerCase();
    if (/^(combobox|searchbox|spinbutton)$/.test(role) || /^(list|both)$/i.test(z.getAttribute('aria-autocomplete') || '')) return null;
    if (AUTOCOMPLETE.test(z.getAttribute('autocomplete') || '')) return null;
    if (NOM.test(dit(z)) || RECHERCHE.test(dit(z)) || z.closest(CODE)) return null;
    if (z.localName === 'input') {
      const t = (z.getAttribute('type') || '').toLowerCase();
      if (!['', 'text'].includes(t)) return null; // ni password, ni search, ni email, ni tel, ni number…
      if (z.hasAttribute('list')) return null; // une liste de complétion
      if (z.form?.querySelector('input[type=password]')) return null; // un formulaire de connexion
    }
    return z;
  }

  // Le texte d’une zone, sans ce qu’elle cite ; les retours de ligne des blocs sont gardés
  function lignes(n) {
    let s = '';
    for (const k of n.childNodes) {
      if (k.nodeType === 3) s += k.data;
      else if (k.nodeType === 1 && !(k.matches && k.matches(CITE))) {
        if (k.localName === 'br') { s += '\n'; continue; }
        const b = BLOC.test(k.localName); if (b && s && !s.endsWith('\n')) s += '\n';
        s += lignes(k); if (b && !s.endsWith('\n')) s += '\n';
      }
    }
    return s;
  }
  const texte = z => (z.localName === 'textarea' || z.localName === 'input' ? z.value : lignes(z)).replace(/ /g, ' ');
  const propre = t => t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const motsDe = s => s.split(/\s+/).filter(m => /\p{L}/u.test(m)).length;

  // Clé de champ, stable d’un chargement à l’autre d’une même page : on ne garde que la DERNIÈRE version d’un même champ.
  function cle(z) {
    const d = z.ownerDocument, tag = z.localName;
    const mêmes = [...d.querySelectorAll(z.isContentEditable ? '[contenteditable]' : tag)];
    const rang = Math.max(0, mêmes.indexOf(z));
    const nom = z.getAttribute('name') || z.id || z.getAttribute('aria-label') || z.getAttribute('data-testid') || '';
    return `${location.hostname}|${location.pathname}|${tag}|${nom}|${rang}`;
  }

  // Une session par champ actif : son texte d’entrée (pour ne garder que ce qui a changé) et ce qu’on y a collé/déposé
  const sessions = new WeakMap();
  const session = z => { let s = sessions.get(z); if (!s) { s = { avant: texte(z), colle: [] }; sessions.set(z, s); } return s; };
  let courante = null;

  function cueillir(z) {
    if (!z) return; const s = sessions.get(z); if (!s) return;
    let t = texte(z);
    if (t === s.avant) return; // rien ajouté depuis le focus : on ne reprend pas un texte déjà là
    for (const c of s.colle) if (c) t = t.split(c).join(' '); // retirer ce qui a été collé/déposé
    t = propre(t);
    if (motsDe(t) < MOTS || !permis()) return;
    ext.runtime.sendMessage({ type: 'glane', cle: cle(z), jour: jour(), site: location.hostname, at: Date.now(), texte: t }).catch(() => {});
    s.avant = texte(z); // la prochaine coupe repartira d’ici
  }

  const estEnvoi = el => { // un bouton d’envoi : type=submit, ou dont le rôle/texte/label le dit
    const b = el.closest?.('button, [role="button"], input[type="submit"], a[role="button"]'); if (!b) return false;
    if (b.matches('input[type="submit"], button[type="submit"]')) return true;
    return ENVOI.test([b.getAttribute('aria-label'), b.getAttribute('data-tooltip'), b.textContent].filter(Boolean).join(' '));
  };

  const ecoute = {
    focusin() { const z = zone(profond()); if (z) { session(z); courante = z; } },
    focusout() { const z = courante; courante = null; cueillir(z); }, // la perte du focus après une modification
    paste(e) { const s = courante && sessions.get(courante), t = e.clipboardData?.getData('text/plain'); if (s && t) s.colle.push(t.replace(/\r\n?/g, '\n')); },
    drop(e) { const s = courante && sessions.get(courante), t = e.dataTransfer?.getData('text/plain'); if (s && t) s.colle.push(t); },
    // Entrée sur une ligne envoie souvent, et la page vide la zone aussitôt : on regarde juste avant, et on reprend ce texte-là
    keydown(e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !courante) return;
      if (courante.localName === 'textarea' || courante.isContentEditable) return; // là, Entrée = nouvelle ligne
      const z = courante; cueillir(z); if (sessions.get(z)) sessions.get(z).avant = '';
    },
    click(e) { if (courante && estEnvoi(e.target)) cueillir(courante); }, // clic sur un bouton d’envoi
    submit() { cueillir(courante); },
    pagehide() { cueillir(courante); },
  };
  const cache = () => { if (document.hidden) cueillir(courante); };

  // Rebrancher est sans risque (un même écouteur ne compte qu’une fois). Une page qui réécrit son cadre avec document.open()
  // efface les écouteurs de sa fenêtre, ceux de l’extension compris : on les remet quand <html> change.
  const brancher = () => { for (const [nom, f] of Object.entries(ecoute)) addEventListener(nom, f, true); document.addEventListener('visibilitychange', cache); };
  brancher();
  let racine = document.documentElement;
  try { new MutationObserver(() => { if (document.documentElement !== racine) { racine = document.documentElement; brancher(); } }).observe(document, { childList: true }); } catch { /* document figé */ }
})();
