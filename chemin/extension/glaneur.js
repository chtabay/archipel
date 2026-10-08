// L’extension du chemin : le glaneur. Dans chaque cadre de chaque page, il regarde ce qu’on écrit soi-même dans les zones de
// texte, et le confie au fond de l’extension, sur cet ordinateur. Rien ne part. Jamais : les mots de passe, les cartes, les
// codes, les identifiants, les recherches (sauf sur les moteurs qu’on a choisis), ce qu’on colle, ce qu’on cite.
// On ne suit pas les touches : on compare la zone à l’entrée et à la sortie, et on ne garde que ce qui a été ajouté.
// Le fond ne branche ce script qu’après l’accord, et le débranche en pause ; ici, on relit quand même les réglages.
(() => {
  if (globalThis.__glaneurChemin) return; globalThis.__glaneurChemin = true;
  const ext = globalThis.browser ?? globalThis.chrome;
  if (!ext?.runtime?.id) return;
  const host = location.hostname;

  const MOTS = 4, MOTS_RECHERCHE = 2; // en dessous, ce n’est pas un écrit : un nom, une date, un « ok » ; une recherche est courte
  const AUTOCOMPLETE = /\b(cc-[a-z-]+|current-password|new-password|one-time-code|username|email|impp|tel(-[a-z-]+)?|street-address|address-line\d|address-level\d|postal-code|country(-name)?|bday(-[a-z]+)?|transaction-[a-z]+|webauthn|name|given-name|family-name)\b/i;
  const SENSIBLE = /pass|pwd|mdp|secret|card|carte|\bcb\b|iban|\bbic\b|swift|cvv|cvc|cryptogramme|otp|2fa|code|\bpin\b|ssn|s[ée]cu|login|identifiant|user|e-?mail|courriel|phone|t[ée]l[ée]phone/i;
  const RECHERCHE = /search|recherche|rechercher|query|\bq\b/i;
  const CODE = '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor'; // du code n’est pas un écrit de la journée
  const CITE = 'blockquote, .gmail_quote, .gmail_attr, [data-glaneur="non"]'; // ce qu’on cite est écrit par d’autres
  const BLOC = /^(div|p|li|h[1-6]|blockquote|pre|tr|section|article|ul|ol)$/;
  const JAMAIS = ['chtabay.github.io']; // l’archipel et le chemin eux-mêmes : ce qu’on y dépose n’est pas glané

  let reglages = { accord: false, pause: false, exclus: [], recherches: [] }; // rien tant qu’on n’a pas dit oui
  const dans = liste => liste.some(h => host === h || host.endsWith(`.${h}`));
  const lire = () => ext.storage.local.get(['accord', 'pause', 'exclus', 'recherches']).then(r => {
    const avant = permis();
    reglages = { accord: r.accord === true, pause: r.pause === true, exclus: Array.isArray(r.exclus) ? r.exclus : [], recherches: Array.isArray(r.recherches) ? r.recherches : [] };
    if (permis() && !avant && courante) sessions.get(courante).avant = texte(courante); // le oui vaut pour la suite, pas pour ce qui est déjà tapé
  }).catch(() => {});
  const permis = () => reglages.accord && !reglages.pause && !ext.extension?.inIncognitoContext && !dans(JAMAIS) && !dans(reglages.exclus);
  const moteur = () => dans(reglages.recherches); // un moteur de recherche choisi : ce qu’on y cherche compte

  // la zone où l’on écrit vraiment, à travers les ombres, même fermées
  const ombre = el => el.shadowRoot || ext.dom?.openOrClosedShadowRoot?.(el) || el.openOrClosedShadowRoot || null;
  function profond() { let a = document.activeElement; for (;;) { const r = a && ombre(a); if (!r?.activeElement) return a; a = r.activeElement; } }
  const hote = el => { let h = el; while (h.parentElement?.isContentEditable) h = h.parentElement; return h; };
  const dit = el => [el.getAttribute('name'), el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('data-testid')].filter(Boolean).join(' ');
  function zone(el) { // la zone d’écriture, ou null si ce qu’on y tape ne regarde pas le chemin
    if (!el || el.nodeType !== 1) return null;
    const z = el.isContentEditable ? hote(el) : el;
    if (!(z.localName === 'textarea' || z.localName === 'input' || z.isContentEditable)) return null;
    const role = z.getAttribute('role') || '', completion = z.getAttribute('aria-autocomplete') || '', nom = dit(z);
    if (!moteur() && (/^(combobox|searchbox|spinbutton)$/i.test(role) || /^(list|both)$/i.test(completion) || RECHERCHE.test(nom))) return null;
    if (AUTOCOMPLETE.test(z.getAttribute('autocomplete') || '') || SENSIBLE.test(nom) || z.closest(CODE)) return null;
    if (z.localName === 'input') {
      if (!['', 'text', 'search'].includes((z.getAttribute('type') || '').toLowerCase()) || (z.hasAttribute('list') && !moteur())) return null;
      if (z.form?.querySelector('input[type=password]')) return null; // un formulaire de connexion
    }
    return z;
  }

  // le texte d’une zone, sans ce qu’elle cite
  function lignes(n) {
    let s = '';
    for (const k of n.childNodes) {
      if (k.nodeType === 3) s += k.data;
      else if (k.nodeType === 1 && !k.matches(CITE)) {
        if (k.localName === 'br') { s += '\n'; continue; }
        const b = BLOC.test(k.localName); if (b && s && !s.endsWith('\n')) s += '\n';
        s += lignes(k); if (b && !s.endsWith('\n')) s += '\n';
      }
    }
    return s;
  }
  const texte = z => (z.localName === 'textarea' || z.localName === 'input' ? z.value : lignes(z)).replace(/ /g, ' ');
  // ce qui a été ajouté entre deux états : on retire le début et la fin communs
  function ajout(avant, apres) {
    let i = 0; while (i < avant.length && i < apres.length && avant[i] === apres[i]) i++;
    let j = 0; while (j < avant.length - i && j < apres.length - i && avant[avant.length - 1 - j] === apres[apres.length - 1 - j]) j++;
    return apres.slice(i, apres.length - j);
  }
  const mots = s => s.split(/\s+/).filter(m => /\p{L}/u.test(m)).length;

  const sessions = new WeakMap(); let courante = null;
  lire(); ext.storage.onChanged.addListener(lire);
  const nouveauFil = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; // randomUUID manque hors https
  const session = z => { let s = sessions.get(z); if (!s) { s = { fil: nouveauFil(), avant: texte(z), colle: [] }; sessions.set(z, s); } return s; };
  function cueillir(z, etat = z && texte(z)) {
    const s = z && sessions.get(z); if (!s) return;
    let t = ajout(s.avant, etat); s.avant = texte(z);
    for (const c of s.colle) t = t.split(c).join(' '); s.colle = [];
    t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (mots(t) < (moteur() ? MOTS_RECHERCHE : MOTS) || !permis()) return;
    ext.runtime.sendMessage({ type: 'glane', fil: s.fil, texte: t }).catch(() => {});
  }

  const ecoute = {
    focusin() { const z = zone(profond()); if (z) { session(z); courante = z; } },
    focusout() { const z = courante; courante = null; cueillir(z); },
    // ce qu’on colle ou dépose n’est pas de soi
    paste(e) { const s = courante && sessions.get(courante), t = e.clipboardData?.getData('text/plain'); if (s && t) s.colle.push(t.replace(/\r\n?/g, '\n')); },
    drop(e) { const s = courante && sessions.get(courante), t = e.dataTransfer?.getData('text/plain'); if (s && t) s.colle.push(t); },
    // Entrée envoie souvent le message, et la page vide la zone aussitôt : on regarde juste avant, et juste après
    keydown(e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !courante) return;
      const z = courante, avant = texte(z);
      setTimeout(() => { if (texte(z).trim().length < avant.trim().length / 2) cueillir(z, avant); }, 60);
    },
    submit() { cueillir(courante); },
    pagehide() { cueillir(courante); },
  };
  const cache = () => { if (document.hidden) cueillir(courante); };
  // Un même écouteur ajouté deux fois ne compte qu’une fois : rebrancher est sans risque. Une page qui écrit son cadre vide
  // avec document.open() efface tous les écouteurs de sa fenêtre, ceux de l’extension compris : on les remet.
  const brancher = () => { for (const [nom, f] of Object.entries(ecoute)) addEventListener(nom, f, true); document.addEventListener('visibilitychange', cache); };
  brancher();
  let racine = document.documentElement;
  new MutationObserver(() => { if (document.documentElement !== racine) { racine = document.documentElement; brancher(); } }).observe(document, { childList: true });
})();
