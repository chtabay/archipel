// L’extension du chemin : le glaneur. Dans chaque cadre de chaque page, il regarde ce qu’on écrit soi-même dans les zones de
// texte, et le confie au fond de l’extension, sur cet ordinateur. Rien ne part. Jamais : les mots de passe, les cartes, les
// codes, les identifiants, les destinataires et les objets d’un courriel, les recherches (sauf la boîte de recherche des
// moteurs qu’on a choisis), ce qu’on colle, ce qu’on cite. On ne suit pas les touches : on compare la zone à l’entrée et à la
// sortie, et on ne garde que ce qui a été ajouté. Le fond ne branche ce script qu’après l’accord, et le débranche en pause ;
// ici, on relit quand même les réglages.
(() => {
  if (globalThis.__glaneurChemin) return; globalThis.__glaneurChemin = true;
  const ext = globalThis.browser ?? globalThis.chrome;
  if (!ext?.runtime?.id) return;
  const host = location.hostname;

  const MOTS = 4, MOTS_RECHERCHE = 2; // en dessous, ce n’est pas un écrit : un nom, une date, un « ok » ; une recherche est courte
  const AUTOCOMPLETE = /\b(cc-[a-z-]+|current-password|new-password|one-time-code|username|email|impp|tel(-[a-z-]+)?|street-address|address-line\d|address-level\d|postal-code|country(-name)?|bday(-[a-z]+)?|transaction-[a-z]+|webauthn|name|given-name|family-name)\b/i;
  const SENSIBLE = /pass|pwd|mdp|secret|card|carte|\bcb\b|iban|\bbic\b|swift|cvv|cvc|cryptogramme|otp|2fa|code|\bpin\b|ssn|s[ée]cu|login|identifiant|user|e-?mail|courriel|phone|t[ée]l[ée]phone/i;
  const ENTETE = /subject|objet|subjectbox|destinataire|recipient|\bcc\b|\bbcc\b|\bcci\b/i; // l’objet et les destinataires d’un courriel : pas un écrit
  const RECHERCHE = /search|recherche|rechercher|query|\bq\b/i;
  const CODE = '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor'; // du code n’est pas un écrit de la journée
  const CITE = 'blockquote, .gmail_quote, .gmail_attr, #divRplyFwdMsg, #appendonsend, [data-glaneur="non"]'; // ce qu’on cite est écrit par d’autres
  const BLOC = /^(div|p|li|h[1-6]|blockquote|pre|tr|section|article|ul|ol)$/;
  const BOUTON = 'button, [role="button"], input[type="submit"], input[type="button"], [type="submit"]';
  const JAMAIS = ['chtabay.github.io']; // l’archipel et le chemin eux-mêmes : ce qu’on y dépose n’est pas glané
  const DELAIS = [60, 250, 1000, 2500]; // après Entrée ou un bouton : la page vide la zone tout de suite, ou après un aller-retour

  let reglages = { accord: false, pause: false, exclus: [], recherches: [] }; // rien tant qu’on n’a pas dit oui
  const sous = liste => liste.some(h => host === h || host.endsWith(`.${h}`)); // un site exclu l’est avec ses sous-domaines
  const lire = () => ext.storage.local.get(['accord', 'pause', 'exclus', 'recherches']).then(r => {
    const avant = permis();
    reglages = { accord: r.accord === true, pause: r.pause === true, exclus: Array.isArray(r.exclus) ? r.exclus : [], recherches: Array.isArray(r.recherches) ? r.recherches : [] };
    if (permis() && !avant && courante) sessions.get(courante).avant = texte(courante); // le oui vaut pour la suite, pas pour ce qui est déjà tapé
  }).catch(() => {});
  const permis = () => reglages.accord && !reglages.pause && !ext.extension?.inIncognitoContext && !sous(JAMAIS) && !sous(reglages.exclus);
  const moteur = () => reglages.recherches.some(h => host === h || host === `www.${h}`); // le moteur lui-même, pas mail.google.com

  // la zone où l’on écrit vraiment, à travers les ombres, même fermées
  const ombre = el => el.shadowRoot || ext.dom?.openOrClosedShadowRoot?.(el) || el.openOrClosedShadowRoot || null;
  function profond() { let a = document.activeElement; for (;;) { const r = a && ombre(a); if (!r?.activeElement) return a; a = r.activeElement; } }
  const hote = el => { let h = el; while (h.parentElement?.isContentEditable) h = h.parentElement; return h; };
  const dit = el => [el.getAttribute('name'), el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('data-testid')].filter(Boolean).join(' ').replace(/#\S+/g, ''); // sans les noms de canaux (« #secu »)
  function zone(el) { // la zone d’écriture, ou null si ce qu’on y tape ne regarde pas le chemin
    if (!el || el.nodeType !== 1) return null;
    const z = el.isContentEditable ? hote(el) : el;
    if (!(z.localName === 'textarea' || z.localName === 'input' || z.isContentEditable)) return null;
    const nom = dit(z), type = (z.getAttribute('type') || '').toLowerCase();
    if (AUTOCOMPLETE.test(z.getAttribute('autocomplete') || '') || SENSIBLE.test(nom) || ENTETE.test(nom) || z.closest(CODE)) return null;
    if (z.form?.querySelector('input[type=password]')) return null; // un formulaire de connexion
    if (boiteDe(z)) return moteur() ? z : null; // une boîte de recherche : seulement sur un moteur choisi
    if (/^spinbutton$/i.test(z.getAttribute('role') || '') || (z.localName === 'input' && !['', 'text'].includes(type))) return null;
    return z;
  }
  const boiteDe = z => { // une boîte de recherche, ou une liste à compléter
    const role = z.getAttribute('role') || '', completion = z.getAttribute('aria-autocomplete') || '', type = (z.getAttribute('type') || '').toLowerCase();
    return /^(combobox|searchbox)$/i.test(role) || /^(list|both)$/i.test(completion) || RECHERCHE.test(dit(z)) || type === 'search' || z.hasAttribute('list');
  };

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
  // ce qui a été ajouté entre deux états : on retire le début et la fin communs, puis les lignes qui étaient déjà là (une réponse
  // glissée entre deux paragraphes cités n’emporte pas le paragraphe du milieu)
  function ajout(avant, apres) {
    let i = 0; while (i < avant.length && i < apres.length && avant[i] === apres[i]) i++;
    let j = 0; while (j < avant.length - i && j < apres.length - i && avant[avant.length - 1 - j] === apres[apres.length - 1 - j]) j++;
    const deja = new Set(avant.split('\n').map(l => l.trim()).filter(l => l.length > 2));
    return apres.slice(i, apres.length - j).split('\n').filter(l => !deja.has(l.trim())).join('\n');
  }
  const mots = s => s.split(/\s+/).filter(m => /\p{L}/u.test(m)).length;
  const propre = s => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const sessions = new WeakMap(); let courante = null;
  lire(); ext.storage.onChanged.addListener(lire);
  const nouveauFil = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; // randomUUID manque hors https
  const session = z => { let s = sessions.get(z); if (!s) { s = { fil: nouveauFil(), avant: texte(z), colle: [], touche: false, rattrape: '' }; sessions.set(z, s); } return s; };
  function cueillir(z, etat = z && texte(z)) {
    const s = z && sessions.get(z); if (!s) return;
    let t = ajout(s.avant, etat); s.avant = z.isConnected ? texte(z) : etat;
    for (const c of s.colle) for (const l of c.split('\n').map(x => x.trim()).filter(x => x.length > 2)) t = t.split(l).join(' '); // ce qu’on a collé n’est pas de soi
    s.colle = [];
    t = propre(t);
    if (s.rattrape) { t = propre(`${s.rattrape}\n${t}`); s.rattrape = ''; } // un écrit que le fond n’a pas pu prendre
    if (mots(t) < (moteur() && boiteDe(z) ? MOTS_RECHERCHE : MOTS) || !permis()) return; // une recherche est courte ; un écrit, non
    const envoi = { type: 'glane', fil: s.fil, texte: t };
    Promise.resolve().then(() => ext.runtime.sendMessage(envoi)).then(ok => { if (ok === false) s.rattrape = t; }).catch(() => { s.rattrape = t; });
  }
  // après Entrée, ou un bouton : si la page vide la zone, ou la retire, l’écrit a été envoyé
  function surveiller(z) {
    if (!z || !sessions.get(z)) return;
    const avant = texte(z); let fait = false;
    for (const d of DELAIS) setTimeout(() => { if (fait) return; if (!z.isConnected || texte(z).trim().length < avant.trim().length / 2) { fait = true; cueillir(z, avant); } }, d);
  }

  const ecoute = {
    focusin() { const z = zone(profond()); if (z) { session(z); courante = z; } },
    focusout() { const z = courante; courante = null; cueillir(z); },
    keydown(e) {
      const s = courante && sessions.get(courante); if (!s) return;
      if (!s.touche) { s.touche = true; s.avant = texte(courante); } // la ligne de base, au premier geste : ce que la page a glissé entre-temps n’est pas de soi
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) surveiller(courante); // Entrée, ou Ctrl+Entrée, envoie souvent
    },
    // ce qu’on colle ou dépose n’est pas de soi : le texte brut, et le texte du HTML collé, dont les lignes diffèrent parfois
    paste(e) {
      const s = courante && sessions.get(courante); if (!s) return;
      const t = e.clipboardData?.getData('text/plain'), h = e.clipboardData?.getData('text/html');
      if (t) s.colle.push(t.replace(/\r\n?/g, '\n'));
      if (h) { try { s.colle.push(lignes(new DOMParser().parseFromString(h, 'text/html').body)); } catch { /* du HTML cassé : le texte brut suffit */ } }
    },
    drop(e) { const s = courante && sessions.get(courante), t = e.dataTransfer?.getData('text/plain'); if (s && t) s.colle.push(t); },
    pointerdown(e) { if (courante && e.target?.closest?.(BOUTON)) surveiller(courante); }, // un bouton d’envoi qui garde le focus dans la zone
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
