// L’archipel : le serveur de l’archipel partagé, dans un espace à part de la base de Pyramide.
// On n’y envoie que la forme d’une île, et seulement quand on choisit de l’y mettre. Un jeton secret, gardé sur ce
// téléphone, permet de la faire grandir ou de la retirer. La clé ci-dessous est publique par nature : elle ne donne
// accès qu’aux trois fonctions de l’archipel.

export const ARCHIPEL = 'https://alvxrjftenialifyktyz.supabase.co/rest/v1/rpc/';
const CLE = 'sb_publishable_JTwbhl8YTGJ9dPUmIwxctQ_vlu96NgE';

async function appeler(fonction, corps, delai = 10000) {
  const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), delai);
  try {
    const r = await fetch(ARCHIPEL + fonction, { method: 'POST', headers: { apikey: CLE, 'Content-Type': 'application/json' }, body: JSON.stringify(corps), signal: arret.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    const texte = await r.text(), json = texte ? JSON.parse(texte) : null;
    if (!r.ok) { const e = new Error(json?.message || `archipel : ${r.status}`); e.statut = r.status; throw e; }
    return json;
  } finally { clearTimeout(minuteur); }
}

// les îles les plus récentes, ou celles arrivées et grandies depuis un rang : [{ ile, ordre, forme, x, z, total }]
export const lireArchipel = (depuis = 0, limite = 60) => appeler('archipel_lire', { p_depuis: depuis, p_limite: limite });
// poser une île (sa place x, z), ou la faire grandir (ile) : { ile, ordre }
export const poserIle = (jeton, forme, { x = null, z = null, ile = null } = {}) => appeler('archipel_poser', { p_jeton: jeton, p_forme: forme, p_x: x, p_z: z, p_ile: ile }).then(r => r?.[0]);
// la retirer : vrai si elle y était
export const retirerIle = (ile, jeton) => appeler('archipel_retirer', { p_ile: ile, p_jeton: jeton });
// un jeton secret, tiré au hasard sur ce téléphone
export const nouveauJeton = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
