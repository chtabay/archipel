// L’archipel : la carte postale. Une photo de l’île, peinte à l’aquarelle sur ce téléphone, en deux passes de pinceau.
// La première simplifie les formes en aplats et fait trembler leurs bords, comme à main levée (un filtre de Kuwahara) ;
// la seconde pose le pigment sur le papier : plus sombre au bord des aplats, là où l’eau a séché ; inégal, et déposé dans
// le creux du grain. Le lavis de la mer s’arrête en bord irrégulier, à quelque distance de l’île ; autour, le papier reste nu.
// L’image ne quitte pas le téléphone : on la garde, ou on l’envoie soi-même.
// Le chemin, l’autre app du site, s’en sert aussi pour peindre sa frise, tuile après tuile : le bruit y suit les coordonnées
// de toute la frise, pour que deux tuiles voisines se raccordent sans couture.

const SOMMET = 'attribute vec2 p; varying vec2 uv; void main() { uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
const BRUIT = `uniform sampler2D bruit;
float vb(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return texture2D(bruit, (i + f + .5) / 256.).r; }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vb(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= .5; } return s / .9375; }`;
const R = 5; // le rayon du pinceau, en pixels

// Les aplats : huit secteurs autour de chaque point ; le plus uni l’emporte, et le bord reste net (Kyprianidis, 2010)
const APLATS = `precision highp float;
uniform sampler2D img; uniform vec2 taille, decalage; varying vec2 uv;
${BRUIT}
void main() {
  vec2 px = uv * taille, pg = px + decalage, c0 = px + (vec2(fbm(pg / 40.), fbm(pg / 40. + 41.7)) - .5) * 7.;
  vec4 m[8]; vec3 s[8]; float w[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.); s[k] = vec3(0.); }
  float zeta = .33, zc = .58, sz = sin(zc), eta = (zeta + cos(zc)) / (sz * sz);
  for (int j = -${R}; j <= ${R}; j++) for (int i = -${R}; i <= ${R}; i++) {
    vec2 o = vec2(float(i), float(j)), v = o / ${R}.;
    if (dot(v, v) > 1.) continue;
    vec3 c = texture2D(img, (c0 + o) / taille).rgb;
    float vxx = zeta - eta * v.x * v.x, vyy = zeta - eta * v.y * v.y, z;
    z = max(0., v.y + vxx); w[0] = z * z; z = max(0., -v.x + vyy); w[2] = z * z; z = max(0., -v.y + vxx); w[4] = z * z; z = max(0., v.x + vyy); w[6] = z * z;
    vec2 r = .7071068 * vec2(v.x - v.y, v.x + v.y);
    vxx = zeta - eta * r.x * r.x; vyy = zeta - eta * r.y * r.y;
    z = max(0., r.y + vxx); w[1] = z * z; z = max(0., -r.x + vyy); w[3] = z * z; z = max(0., -r.y + vxx); w[5] = z * z; z = max(0., r.x + vyy); w[7] = z * z;
    float som = 0.; for (int k = 0; k < 8; k++) som += w[k];
    float g = exp(-3.125 * dot(v, v)) / max(som, 1e-5);
    for (int k = 0; k < 8; k++) { float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
  }
  vec4 o = vec4(0.);
  for (int k = 0; k < 8; k++) {
    vec3 mk = m[k].rgb / max(m[k].w, 1e-5), sk = abs(s[k] / max(m[k].w, 1e-5) - mk * mk);
    float wk = 1. / (1. + pow(255. * (sk.r + sk.g + sk.b), 4.));
    o += vec4(mk * wk, wk);
  }
  gl_FragColor = vec4(o.rgb / o.w, 1.);
}`;

// Le pigment, sur le papier. À hauteur d’île, des nuages réservés dans le ciel, blancs, gris par-dessous, et des reflets
// couchés sur la mer
const PIGMENT = `precision highp float;
uniform sampler2D aplat, halo; uniform vec2 taille; uniform vec3 papier; uniform float paysage, horizon, sombre; varying vec2 uv;
${BRUIT}
float grain(vec2 p) { return vb(p / 3.1) * .6 + vb(p / 7.3 + 13.) * .4; }
float nuee(vec2 px) { vec2 q = vec2(px.x / 300., px.y / 95.); return fbm(q + 5.3) * .75 + vb(q * 3.1 + 9.) * .25; }
void main() {
  vec2 px = uv * taille, e = 1. / taille;
  float g = grain(px), gx = grain(px + vec2(1., 0.)) - g, gy = grain(px + vec2(0., 1.)) - g;
  vec2 q = uv + vec2(gx, gy) * 2. * e;
  vec3 c = texture2D(aplat, q).rgb;
  vec3 dx = texture2D(aplat, q + vec2(1.5, 0.) * e).rgb - texture2D(aplat, q - vec2(1.5, 0.) * e).rgb;
  vec3 dy = texture2D(aplat, q + vec2(0., 1.5) * e).rgb - texture2D(aplat, q - vec2(0., 1.5) * e).rgb;
  float bord = smoothstep(.04, .28, length(dx) + length(dy));
  vec2 h = texture2D(halo, uv).rg, m = vec2(min(uv.x, 1. - uv.x) * taille.x, min(uv.y - .07, 1. - uv.y) * taille.y) / taille.y;
  float champ = mix(max(h.r, h.g), clamp(min(m.x, m.y) / .16, 0., 1.), paysage), seuil = mix(.12, .42, paysage) + (fbm(px / 140. + 21.) - .5) * mix(.16, .4, paysage) + (vb(px / 7. + 3.) - .5) * .03;
  float net = smoothstep(.3, .5, fbm(px / 300. + 31.)), large = mix(.05, .008, net);
  float lavis = smoothstep(seuil - large, seuil + large, champ);
  float lisere = lavis * (1. - smoothstep(seuil, seuil + .04, champ)) * net;
  float sec = (1. - smoothstep(seuil, seuil + .08, champ)) * (1. - net);
  lavis *= 1. - sec * smoothstep(.55, .75, g);
  float dilue = mix(.5, 1., smoothstep(seuil, seuil + .3, champ)) * mix(1., smoothstep(.06, .42, uv.y), paysage * .55);
  float f = fbm(px / 90. + 51.), fleur = smoothstep(.04, 0., abs(f - .56)) * smoothstep(.4, .75, fbm(px / 400. + 7.));
  float ciel = paysage * smoothstep(horizon + .012, horizon + .07, uv.y), haut = smoothstep(horizon + .05, horizon + .3, uv.y);
  float nuage = ciel * smoothstep(.57 - .07 * haut, .69 - .07 * haut, nuee(px)), dessus = smoothstep(.57, .69, nuee(px + vec2(0., 34.)));
  float eau = paysage * (1. - smoothstep(horizon - .012, horizon, uv.y)) * (1. - h.r), pres = clamp((horizon - uv.y) / horizon, 0., 1.);
  float trait = fbm(vec2(px.x / 110., px.y / mix(2.4, 6.5, pres)) + 3.7);
  float d = 1. + 1.1 * bord + 1.1 * lisere + .22 * fleur + .8 * (fbm(px / 170. + 3.1) - .5) + .35 * (fbm(px / 40. + 9.7) - .5)
    + .22 * (.5 - g) + .12 * (vb(px / 1.3 + 5.3) - .5) + .2 * (1. - h.r) * (1. - paysage) + .55 * eau * (trait - .5);
  vec3 p = 1. - (1. - c) * .88;
  p *= 1. + (fbm(px / 230. + 77.) - .5) * vec3(.08, 0., -.08);
  p = clamp(p - (p - p * p) * (d - 1.), 0., 1.);
  p = mix(p, vec3(1.), nuage * .92); // le nuage : le papier, réservé
  p = mix(p, mix(vec3(.8, .8, .86), vec3(.56, .57, .64), sombre), nuage * dessus * .55 * (1. - .3 * g)); // et son dessous, gris
  float eclat = eau * smoothstep(.74, .8, trait) * smoothstep(.5, .75, vb(px / 26.)) * (1. - .75 * pres); // des éclats de papier sur l’eau, vers le large
  vec3 fond = papier * (1. + (gx - gy) * .35);
  gl_FragColor = vec4(fond * mix(vec3(1.), p, lavis * dilue * (1. - .6 * eclat)), 1.);
}`;
// La frise du chemin : le lavis s’arrête en haut et en bas, jamais sur les côtés ; le ciel garde ses nuages, l’eau ses
// reflets ; et le temps de chaque jour teinte la peinture, d’un jour à l’autre sans à-coup
const FRISE = `precision highp float;
uniform sampler2D aplat, halo; uniform vec2 taille, decalage; uniform vec3 papier, jours; uniform vec4 ta, tb, tc, sa, sb, sc, ma, mb, mc, na, nb, nc, astre; varying vec2 uv;
${BRUIT}
float grain(vec2 p) { return vb(p / 3.1) * .6 + vb(p / 7.3 + 13.) * .4; }
float nuee(vec2 px) { vec2 q = vec2(px.x / 300., px.y / 95.); return fbm(q + 5.3) * .75 + vb(q * 3.1 + 9.) * .25; }
vec4 suivre(vec4 a, vec4 b, vec4 c, float x) { return x < jours.y ? mix(a, b, clamp((x - jours.x) / (jours.y - jours.x), 0., 1.)) : mix(b, c, clamp((x - jours.y) / (jours.z - jours.y), 0., 1.)); }
void main() {
  vec2 px = uv * taille + decalage, e = 1. / taille;
  float g = grain(px), gx = grain(px + vec2(1., 0.)) - g, gy = grain(px + vec2(0., 1.)) - g;
  vec2 q = uv + vec2(gx, gy) * 2. * e;
  vec3 c = texture2D(aplat, q).rgb;
  vec3 dx = texture2D(aplat, q + vec2(1.5, 0.) * e).rgb - texture2D(aplat, q - vec2(1.5, 0.) * e).rgb;
  vec3 dy = texture2D(aplat, q + vec2(0., 1.5) * e).rgb - texture2D(aplat, q - vec2(0., 1.5) * e).rgb;
  float bord = smoothstep(.04, .28, length(dx) + length(dy));
  vec2 h = texture2D(halo, uv).rg; // en rouge la terre et ce qui s’y pose, en vert l’eau
  float champ = clamp(min(uv.y - .02, 1. - uv.y) / .16, 0., 1.), seuil = .42 + (fbm(px / 140. + 21.) - .5) * .4 + (vb(px / 7. + 3.) - .5) * .03;
  float net = smoothstep(.3, .5, fbm(px / 300. + 31.)), large = mix(.05, .008, net);
  float lavis = smoothstep(seuil - large, seuil + large, champ);
  float lisere = lavis * (1. - smoothstep(seuil, seuil + .04, champ)) * net;
  float sec = (1. - smoothstep(seuil, seuil + .08, champ)) * (1. - net);
  lavis *= 1. - sec * smoothstep(.55, .75, g);
  float dilue = mix(.5, 1., smoothstep(seuil, seuil + .3, champ));
  float f = fbm(px / 90. + 51.), fleur = smoothstep(.04, 0., abs(f - .56)) * smoothstep(.4, .75, fbm(px / 400. + 7.));
  vec4 t = suivre(ta, tb, tc, px.x), s = suivre(sa, sb, sc, px.x); // la teinte du jour : un filtre de couleur, une part de gris ; puis le ciel lourd, l’ombre
  float ciel = (1. - h.r) * (1. - h.g) * smoothstep(.35, .55, uv.y), haut = smoothstep(.55, .9, uv.y);
  float nuage = ciel * smoothstep(.57 - .07 * haut, .69 - .07 * haut, nuee(px)), dessus = smoothstep(.57, .69, nuee(px + vec2(0., 34.)));
  float eau = h.g * (1. - h.r), pres = 1. - smoothstep(.05, .6, uv.y);
  float trait = fbm(vec2(px.x / 110., px.y / mix(2.4, 6.5, pres)) + 3.7);
  float d = 1. + 1.1 * bord + 1.1 * lisere + .22 * fleur + .8 * (fbm(px / 170. + 3.1) - .5) + .35 * (fbm(px / 40. + 9.7) - .5)
    + .22 * (.5 - g) + .12 * (vb(px / 1.3 + 5.3) - .5) + .55 * eau * (trait - .5) + s.y;
  vec3 p = 1. - (1. - c) * .88;
  p *= 1. + (fbm(px / 230. + 77.) - .5) * vec3(.08, 0., -.08);
  p = mix(p, vec3(dot(p, vec3(.3, .59, .11))), t.w) * t.rgb;
  p = clamp(p - (p - p * p) * (d - 1.), 0., 1.);
  p = mix(p, vec3(1.), nuage * .92 * (1. - s.z));
  p = mix(p, mix(vec3(.8, .8, .86), vec3(.56, .57, .64), s.x) * t.rgb, nuage * dessus * .55 * (1. - .3 * g));
  // le temps qu’il fait, d’un jour à l’autre sans à-coup : la pluie, la neige, la brume, la nuit ; le soleil, l’orage
  vec4 m = suivre(ma, mb, mc, px.x), n = suivre(na, nb, nc, px.x);
  float vide = (1. - h.r) * (1. - h.g); // ni terre ni eau : le ciel
  p *= 1. - .12 * n.y;
  float da = length(px - astre.xy), disque = vide * smoothstep(astre.z + 1.5, astre.z - 1.5, da), lueur = vide * exp(-max(da - astre.z, 0.) / 34.);
  if (astre.w > 1.5) { p = mix(p, vec3(1., .86, .58), lueur * .45); p = mix(p, vec3(1., .95, .78), disque); } // le soleil, et sa chaleur autour
  else if (astre.w > .5) { p = mix(p, vec3(.82, .84, .9), lueur * .3); p = mix(p, vec3(.97, .95, .88), disque * (1. - .25 * smoothstep(.45, .8, vb((px - astre.xy) / 9. + 3.)))); } // la lune
  vec2 cs = floor(px / 11.), ps = (cs + .5 + (vec2(vb(cs * 3.71 + 1.3), vb(cs * 5.37 + 2.9)) - .5) * .7) * 11.;
  float etoile = m.w * vide * smoothstep(.5, .78, uv.y) * step(.84, vb(cs * 7.31 + 3.7)) * smoothstep(2.4, 1., length(px - ps)) * (1. - disque);
  p = mix(p, vec3(1., .97, .86), etoile); // les étoiles : le papier, réservé
  p = mix(p, vec3(.93, .94, .95), m.z * (.18 + .62 * smoothstep(.12, .75, uv.y))); // la brume : plus c’est loin, plus le papier revient
  vec2 rp = mat2(.966, -.259, .259, .966) * px; // la pluie, en biais, en filets : assez épais pour se voir sur le téléphone
  float colonne = floor(rp.x / 13.), hz = vb(vec2(colonne * 1.731, 3.17)), longueur = 50. + 90. * vb(vec2(colonne * .37, 9.1));
  float filet = smoothstep(1.7, .7, abs(fract(rp.x / 13.) - .5) * 13.) * step(.58, fract(rp.y / longueur + hz * 7.)) * step(.35, hz);
  p = mix(p, vec3(.4, .45, .54), filet * m.x * .55);
  vec2 cf = floor(px / 24.), pf = (cf + .5 + (vec2(vb(cf * 2.31 + 1.7), vb(cf * 4.13 + 7.9)) - .5) * .8) * 24.;
  float flocon = step(.45, vb(cf * 9.71 + 4.3)) * smoothstep(3.6, 1.8, length(px - pf)) * m.y;
  p = mix(p, vec3(1.), flocon * .95); // la neige : des flocons de papier réservé
  float eclat = eau * smoothstep(.74, .8, trait) * smoothstep(.5, .75, vb(px / 26.)) * (1. - .75 * pres);
  vec3 fond = papier * (1. + (gx - gy) * .35);
  gl_FragColor = vec4(fond * mix(vec3(1.), p, lavis * dilue * (1. - .6 * eclat)), 1.);
}`;
const PAPIER = [.957, .937, .894];

function hasard(graine) { // le bruit : des valeurs tirées d’une graine, pour que la même île, vue du même côté, donne la même carte
  let a = graine >>> 0 || 1; const d = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < d.length; i++) { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; d[i] = (t ^ (t >>> 14)) & 255; }
  return d;
}
function flou(a, w, h, r) { // trois flous en boîte : presque un flou gaussien ; les bords se prolongent
  const x = Float32Array.from(a), y = new Float32Array(w * h), n = 2 * r + 1, cl = (v, m) => Math.min(m - 1, Math.max(0, v));
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < h; j++) { let s = 0; for (let i = -r; i <= r; i++) s += x[j * w + cl(i, w)]; for (let i = 0; i < w; i++) { y[j * w + i] = s / n; s += x[j * w + cl(i + r + 1, w)] - x[j * w + cl(i - r, w)]; } }
    for (let i = 0; i < w; i++) { let s = 0; for (let j = -r; j <= r; j++) s += y[cl(j, h) * w + i]; for (let j = 0; j < h; j++) { x[j * w + i] = s / n; s += y[cl(j + r + 1, h) * w + i] - y[cl(j - r, h) * w + i]; } }
  }
  return x;
}
function halo(sil) { // en rouge, la terre et son rivage ; en vert, loin autour d’elle, jusqu’où va la mer peinte
  const w = sil.width, h = sil.height, px = sil.getContext('2d').getImageData(0, 0, w, h).data, a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = px[4 * i] / 255;
  const pres = flou(a, w, h, 1), loin = flou(a, w, h, Math.max(2, Math.round(w / 13)));
  let max = 0; for (const v of loin) max = Math.max(max, v);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { im.data[4 * i] = Math.min(255, pres[i] * 510); im.data[4 * i + 1] = max ? loin[i] / max * 255 : 0; im.data[4 * i + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}

function masques(sil) { // la frise : la terre en rouge, l’eau en vert, à peine fondues
  const w = sil.width, h = sil.height, px = sil.getContext('2d').getImageData(0, 0, w, h).data, r = new Float32Array(w * h), v = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { r[i] = px[4 * i] / 255; v[i] = px[4 * i + 1] / 255; }
  const R = flou(r, w, h, 1), V = flou(v, w, h, 1), c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { im.data[4 * i] = Math.min(255, R[i] * 300); im.data[4 * i + 1] = Math.min(255, V[i] * 300); im.data[4 * i + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}

function programme(gl, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, SOMMET], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'programme');
  gl.useProgram(p);
  return p;
}
function texture(gl, source, w = 0, h = 0, repete = false) { // une image ; ou des octets (w × h) ; ou rien, pour y peindre
  const t = gl.createTexture(), bord = repete ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, bord); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, bord);
  return t;
}
function lier(gl, p, textures, W, H) { // les textures du programme, chacune à sa place ; et la taille de l’image
  Object.entries(textures).forEach(([nom, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(p, nom), i); });
  gl.uniform2f(gl.getUniformLocation(p, 'taille'), W, H);
}
const souffle = () => new Promise(r => setTimeout(r, 0));

// Les deux passes, sur un contexte WebGL à part, rendu aussitôt après : les aplats, par bandes, puis le pigment, avec ses réglages
async function passer(photo, contour, graine, fs, regler, decalage = [0, 0]) {
  const W = photo.width, H = photo.height, toile = document.createElement('canvas'); toile.width = W; toile.height = H;
  const gl = toile.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) throw new Error('Pas de WebGL pour peindre');
  try {
    if ((gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision || 0) < 16) throw new Error('Pas assez de précision pour peindre');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const bruit = texture(gl, hasard(graine), 256, 256, true), img = texture(gl, photo), aplat = texture(gl, null, W, H), masque = texture(gl, contour);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, aplat, 0);
    const pa = programme(gl, APLATS); lier(gl, pa, { img, bruit }, W, H); gl.uniform2f(gl.getUniformLocation(pa, 'decalage'), ...decalage);
    gl.viewport(0, 0, W, H); gl.enable(gl.SCISSOR_TEST);
    for (let k = 0, n = 8; k < n; k++) { // par bandes : le téléphone respire entre deux, et la vue continue de tourner
      const y0 = Math.floor(k * H / n), y1 = Math.floor((k + 1) * H / n);
      gl.scissor(0, y0, W, y1 - y0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.flush(); await souffle();
    }
    gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const p = programme(gl, fs); lier(gl, p, { aplat, halo: masque, bruit }, W, H); gl.uniform3f(gl.getUniformLocation(p, 'papier'), ...PAPIER);
    gl.uniform2f(gl.getUniformLocation(p, 'decalage'), ...decalage);
    regler(gl, p);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (gl.isContextLost()) throw new Error('Le pinceau a été interrompu');
    const sortie = document.createElement('canvas'); sortie.width = W; sortie.height = H; sortie.getContext('2d').drawImage(toile, 0, 0);
    return sortie;
  } finally { gl.getExtension('WEBGL_lose_context')?.loseContext(); } // la mémoire de la carte graphique est rendue aussitôt
}

// vue : ce que rend la photo de l’île (monde.js) : image, l’île en couleurs ; silhouette, ce qui dépasse de l’eau, blanc sur
// noir, en petit ; paysage, à hauteur d’île ; horizon, sa hauteur ; sombre, un ciel lourd. Rend un canevas de même taille.
export async function peindre(vue, graine = 1) {
  const { image: photo, silhouette, paysage = false, horizon = .66, sombre = false } = vue;
  return passer(photo, halo(silhouette), graine, PIGMENT, (gl, p) => { for (const [nom, v] of [['paysage', +paysage], ['horizon', horizon], ['sombre', +sombre]]) gl.uniform1f(gl.getUniformLocation(p, nom), v); });
}

// Une tuile de la frise du chemin. vue : image, la tuile en couleurs ; silhouette, la terre en rouge et l’eau en vert, en
// petit. decalage : la place de la tuile dans toute la frise, en pixels. jours : la teinte de trois jours, la veille, le jour,
// le lendemain, à leur place : [{ x, teinte: [r, g, b, gris], ciel: [lourd, ombre, voile], meteo: [pluie, neige, brume, nuit],
// astres: [soleil, orage] }]. La nuit, une lune ; au grand soleil, le soleil : dans le ciel du jour, à une place tirée de la graine.
export async function peindreFrise(vue, { graine = 1, decalage = [0, 0], jours }) {
  const W = vue.image.width, H = vue.image.height, j = jours[1], nuit = (j.meteo?.[3] || 0) >= .5, soleil = (j.astres?.[0] || 0) >= .5;
  const u = ((Math.sin((j.x + graine) * 12.9898) * 43758.5453) % 1 + 1) % 1, astre = nuit || soleil ? [j.x + (u - .5) * W * .45, H * (.84 + .05 * u), nuit ? 24 : 30, nuit ? 1 : 2] : [0, 0, 0, 0];
  return passer(vue.image, masques(vue.silhouette), graine, FRISE, (gl, p) => {
    gl.uniform3f(gl.getUniformLocation(p, 'jours'), ...jours.map(j => j.x));
    ['ta', 'tb', 'tc'].forEach((n, i) => gl.uniform4f(gl.getUniformLocation(p, n), ...jours[i].teinte));
    ['sa', 'sb', 'sc'].forEach((n, i) => gl.uniform4f(gl.getUniformLocation(p, n), ...jours[i].ciel, 0));
    ['ma', 'mb', 'mc'].forEach((n, i) => gl.uniform4f(gl.getUniformLocation(p, n), ...(jours[i].meteo || [0, 0, 0, 0])));
    ['na', 'nb', 'nc'].forEach((n, i) => gl.uniform4f(gl.getUniformLocation(p, n), ...(jours[i].astres || [0, 0, 0, 0])));
    gl.uniform4f(gl.getUniformLocation(p, 'astre'), ...astre);
  }, decalage);
}

// La carte : la peinture, et « L’archipel » en bas à droite ; le nom de l’île en bas à gauche, seulement si on le veut
export function legender(peinte, nom = '') {
  const W = peinte.width, H = peinte.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), k = W / 1500, marge = Math.round(46 * k), espace = v => { if ('letterSpacing' in x) x.letterSpacing = `${v}px`; };
  x.drawImage(peinte, 0, 0);
  x.textBaseline = 'alphabetic';
  x.font = `700 ${Math.round(21 * k)}px Nunito, system-ui, sans-serif`; espace(Math.round(4 * k)); x.textAlign = 'right'; x.fillStyle = 'rgba(70, 58, 46, .62)';
  x.fillText('L’ARCHIPEL', W - marge, H - marge);
  if (nom) { x.font = `700 ${Math.round(32 * k)}px Nunito, system-ui, sans-serif`; espace(0); x.textAlign = 'left'; x.fillStyle = 'rgba(66, 54, 44, .74)'; x.fillText(nom, marge, H - marge, W * .62); }
  return c;
}
