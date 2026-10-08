// L’extension du chemin : le fond. Il reçoit ce que le glaneur a lu, et en fait un bloc de plus dans la page du jour, dans le
// carnet du chemin, sur cet ordinateur ; les onglets du chemin ouverts sont prévenus. Il branche le glaneur après l’accord,
// et le débranche en pause. Il ne calcule rien : c’est le chemin, dans l’onglet, qui lit et qui peint.
import * as carnet from './chemin/carnet.js';

const ext = globalThis.browser ?? globalThis.chrome;
const deux = n => String(n).padStart(2, '0');
const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; }; // la date d’ici
const maintenant = () => { const d = new Date(); return `${deux(d.getHours())}:${deux(d.getMinutes())}`; };
const FIL = 30 * 60e3; // un écrit repris dans la même zone pendant une demi-heure reste un seul bloc
const empreinte = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(36) + (a >>> 0).toString(36); }; // le fil retient l’empreinte du bloc, pas son texte : le texte ne vit que dans le carnet
let file = Promise.resolve();
const tour = f => (file = file.then(f, f)); // un écrit après l’autre : deux ne se marchent pas dessus

/* ───────── Un écrit de plus : un bloc dans la page du jour, ou la suite du bloc du même fil ───────── */

async function ajouter({ fil, texte }) {
  texte = texte.trim(); if (!texte) return;
  const date = aujourdhui(), { fils = {} } = await ext.storage.local.get('fils');
  const page = (await carnet.lirePages()).find(p => p.date === date);
  const blocs = page ? (page.blocs?.length ? page.blocs.map(b => ({ ...b })) : [{ heure: '', texte: page.texte }]) : [];
  if (blocs.some(b => b.texte === texte)) return; // le même écrit, deux fois le même jour : une fois suffit
  const f = typeof fil === 'string' && fils[fil]; let i = -1;
  if (f && f.date === date && Date.now() - f.quand < FIL) i = blocs.findIndex(b => b.source === 'glane' && empreinte(b.texte) === f.bloc); // la suite d’un écrit en cours
  if (i >= 0) blocs[i] = { ...blocs[i], texte: `${blocs[i].texte}\n${texte}` }; else blocs.push({ heure: maintenant(), texte, source: 'glane' });
  const bloc = i >= 0 ? blocs[i] : blocs[blocs.length - 1];
  if (!(await carnet.garderPage({ date, blocs, texte: blocs.map(b => b.texte).join('\n\n') }))) return;
  if (typeof fil === 'string') {
    fils[fil] = { date, quand: Date.now(), bloc: empreinte(bloc.texte) };
    for (const [k, v] of Object.entries(fils)) if (Date.now() - v.quand > FIL) delete fils[k];
    await ext.storage.local.set({ fils });
  }
  ext.runtime.sendMessage({ type: 'bloc', date }).catch(() => {}); // les onglets du chemin, s’il y en a
}

ext.runtime.onMessage.addListener((m, expediteur) => {
  if (expediteur.id !== ext.runtime.id || !m || typeof m !== 'object') return;
  if (m.type === 'glane' && typeof m.texte === 'string' && m.texte.length <= 200000) tour(() => ajouter(m).catch(e => console.warn('le chemin, un écrit :', e)));
});

/* ───────── Le glaneur, branché après l’accord, débranché en pause ───────── */

const SCRIPT = { id: 'glaneur', js: ['glaneur.js'], matches: ['<all_urls>'], excludeMatches: ['https://chtabay.github.io/*'], allFrames: true, runAt: 'document_start', persistAcrossSessions: true };
async function brancher() {
  try {
    const { accord, pause } = await ext.storage.local.get(['accord', 'pause']), voulu = accord === true && pause !== true;
    const deja = (await ext.scripting.getRegisteredContentScripts({ ids: ['glaneur'] })).length > 0;
    if (voulu && !deja) {
      try { await ext.scripting.registerContentScripts([{ ...SCRIPT, matchOriginAsFallback: true }]); } // les cadres sans origine (about:blank)
      catch { await ext.scripting.registerContentScripts([SCRIPT]); } // Firefox, sans matchOriginAsFallback
    } else if (!voulu && deja) await ext.scripting.unregisterContentScripts({ ids: ['glaneur'] });
    await ext.action.setBadgeText({ text: accord === true && pause === true ? 'II' : '' }); // en pause, on le voit
  } catch (e) { console.warn('le chemin, le glaneur :', e); }
}
ext.runtime.onInstalled.addListener(({ reason }) => { brancher(); if (reason === 'install') ext.tabs.create({ url: ext.runtime.getURL('accord.html') }); });
ext.runtime.onStartup.addListener(brancher);
ext.storage.onChanged.addListener((ch, zone) => { if (zone === 'local' && (ch.accord || ch.pause)) brancher(); });
brancher(); // à chaque réveil du fond
