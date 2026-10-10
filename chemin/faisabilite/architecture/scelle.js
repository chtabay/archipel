// Essai de faisabilité, pas une pièce de l’app. Un colis scellé de bout en bout : l’ordinateur scelle ses écrits du jour (ou
// leur lecture) avec une clé que seul le téléphone connaît aussi ; un relais idiot (une table Supabase, un fichier dans le
// Drive de la personne, n’importe quoi) ne garde que des octets illisibles, le temps que le téléphone passe les prendre.
//
// L’appairage : l’ordinateur tire une graine de 32 octets et l’affiche en QR code (43 caractères en base64url : un petit
// QR, version 3 ou 4) ; le téléphone la lit avec sa caméra. Elle ne passe jamais par le réseau. De la graine, on tire :
//   - la clé du colis (AES-GCM 256), par HKDF ;
//   - le nom de la boîte aux lettres sur le relais, par HKDF aussi : le relais ne voit qu’un nom au hasard, pas un compte.
// Le colis est complété à une taille fixe (par paliers) : le relais ne devine pas la longueur des écrits.
// WebCrypto seulement : la même chose marche dans le navigateur, l’extension et Node (globalThis.crypto).

const sub = globalThis.crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
export const b64 = o => { let s = ''; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const deB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const PALIERS = [1024, 4096, 16384, 65536, 262144]; // au-delà : plusieurs colis

export const appairer = () => b64(crypto.getRandomValues(new Uint8Array(32))); // ce que montre le QR code
export async function cles(graine) {
  const base = await sub.importKey('raw', deB64(graine), 'HKDF', false, ['deriveKey', 'deriveBits']);
  const hk = info => ({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('le chemin'), info: enc.encode(info) });
  const cle = await sub.deriveKey(hk('chemin/colis/v1'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const boite = b64(new Uint8Array(await sub.deriveBits(hk('chemin/boite/v1'), base, 128)));
  return { cle, boite };
}
export async function sceller({ cle, boite }, colis) {
  const clair = enc.encode(JSON.stringify(colis)), palier = PALIERS.find(p => p >= clair.length + 4);
  if (!palier) throw new Error('colis trop gros : le couper');
  const plein = new Uint8Array(palier); new DataView(plein.buffer).setUint32(0, clair.length); plein.set(clair, 4); // le reste : des zéros
  const id = b64(crypto.getRandomValues(new Uint8Array(12))), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`${boite}/${id}`) }, cle, plein));
  const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12);
  return { boite, id, ct: b64(o) }; // tout ce que le relais voit
}
export async function ouvrir({ cle, boite }, e) {
  if (e.boite !== boite) throw new Error('pas pour cette boîte');
  const o = deB64(e.ct), plein = new Uint8Array(await sub.decrypt({ name: 'AES-GCM', iv: o.subarray(0, 12), additionalData: enc.encode(`${boite}/${e.id}`) }, cle, o.subarray(12)));
  const n = new DataView(plein.buffer).getUint32(0);
  return JSON.parse(dec.decode(plein.subarray(4, 4 + n)));
}
