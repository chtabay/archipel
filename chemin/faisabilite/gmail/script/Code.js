// Le chemin, route B : un script à soi, dans son propre compte Google (script.google.com). Il lit ses mails envoyés, en
// lecture seule, n’en garde que ses propres mots (la même lecture que sur le téléphone, recopiée au-dessus par fabriquer.js),
// et les rend au chemin quand celui-ci les demande avec la bonne clé. Il ne garde rien : ni copie, ni base, ni journal.
// Le texte va de Gmail à ce script, chez Google, puis au téléphone ; nulle part ailleurs.
//
// Installer (une fois, une dizaine de minutes) :
//  1. script.google.com, nouveau projet ; coller Code.gs (fabriqué par fabriquer.js) et appsscript.json (afficher le
//     fichier manifeste dans les paramètres du projet).
//  2. Lancer une fois installer() : Google montre l’écran « application non validée » (le script est le sien, personne ne
//     l’a vérifié), puis demande « Afficher vos e-mails et vos paramètres ». La clé s’affiche dans le journal.
//  3. Déployer, « Application Web », exécuter en tant que « Moi », accès « Tout le monde » ; donner au chemin l’adresse
//     /exec et la clé. Qui a l’adresse et la clé lit ce que ce script rend : ses propres mots des sept derniers jours.
//  4. Pour tout arrêter : archiver le déploiement, ou relancer installer() pour changer la clé.

const JOURS_MAX = 7, MAX_MAILS = 200;

function installer() {
  const cle = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); // 244 bits de hasard
  PropertiesService.getScriptProperties().setProperty('CLE', cle);
  console.log(`La clé à donner au chemin : ${cle}`);
  return cle;
}

function doGet(e) {
  const p = (e && e.parameter) || {}, cle = PropertiesService.getScriptProperties().getProperty('CLE');
  if (!cle || !memeCle(String(p.k || ''), cle)) return rendre({ erreur: 'clé' }, p.callback);
  const depuis = Math.max(Number(p.depuis) || 0, Date.now() - JOURS_MAX * 864e5);
  const { glanes, jusque } = cueillirIci(depuis);
  return rendre({ glanes, jusque }, p.callback);
}

function cueillirIci(depuis) {
  const q = `in:sent -in:chats after:${Math.floor(depuis / 1000)}`, ids = [];
  let page;
  do {
    const r = Gmail.Users.Messages.list('me', { q, maxResults: 100, pageToken: page });
    for (const m of r.messages || []) ids.push(m.id);
    page = r.nextPageToken;
  } while (page && ids.length < MAX_MAILS);
  const glanes = []; let jusque = depuis;
  for (const id of ids.slice(0, MAX_MAILS)) {
    const m = Gmail.Users.Messages.get('me', id, { format: 'full' }), t = Number(m.internalDate);
    if (!(t > depuis)) continue;
    jusque = Math.max(jusque, t);
    const g = glaneDuMessage(m, { texteDe: texteAppsScript }); if (g) glanes.push(g);
  }
  return { glanes: glanes.sort((a, b) => a.debut - b.debut), jusque };
}

// le service avancé rend les données d’une partie en base64url, ou déjà en octets selon les cas : on accepte les deux
function texteAppsScript(data, charset) {
  const o = typeof data === 'string' ? Utilities.base64DecodeWebSafe(data.replace(/=+$/, '') + '==='.slice((data.replace(/=+$/, '').length + 3) % 4)) : data;
  try { return Utilities.newBlob(o).getDataAsString(charset || 'UTF-8'); } catch (err) { return Utilities.newBlob(o).getDataAsString('UTF-8'); }
}

function memeCle(a, b) { let d = a.length ^ b.length; for (let i = 0; i < b.length; i++) d |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i); return d === 0; }

function rendre(objet, rappel) {
  const json = JSON.stringify(objet);
  if (rappel && /^[A-Za-z_$][\w$]{0,40}$/.test(rappel)) { // JSONP, documenté par Google, si un navigateur refusait la réponse JSON
    return ContentService.createTextOutput(`${rappel}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
