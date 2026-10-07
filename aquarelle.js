// L’archipel : la carte postale. Une photo de l’île, peinte à l’aquarelle sur ce téléphone, en deux passes de pinceau.
// La première simplifie les formes en aplats et fait trembler leurs bords, comme à main levée (un filtre de Kuwahara) ;
// la seconde pose le pigment sur le papier : plus sombre au bord des aplats, là où l’eau a séché ; inégal, et déposé dans
// le creux du grain. Le lavis de la mer s’arrête en bord irrégulier, à quelque distance de l’île ; autour, le papier reste nu.
// L’image ne quitte pas le téléphone : on la garde, ou on l’envoie soi-même.

const SOMMET = 'attribute vec2 p; varying vec2 uv; void main() { uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
const BRUIT = `uniform sampler2D bruit;
float vb(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return texture2D(bruit, (i + f + .5) / 256.).r; }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vb(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= .5; } return s / .9375; }`;
const R = 5; // le rayon du pinceau, en pixels

// Les aplats : huit secteurs autour de chaque point ; le plus uni l’emporte, et le bord reste net (Kyprianidis, 2010)
const APLATS = `precision highp float;
uniform sampler2D img; uniform vec2 taille; varying vec2 uv;
${BRUIT}
void main() {
  vec2 px = uv * taille, c0 = px + (vec2(fbm(px / 40.), fbm(px / 40. + 41.7)) - .5) * 7.;
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

// vue : ce que rend la photo de l’île (monde.js) : image, l’île en couleurs ; silhouette, ce qui dépasse de l’eau, blanc sur
// noir, en petit ; paysage, à hauteur d’île ; horizon, sa hauteur ; sombre, un ciel lourd. Rend un canevas de même taille.
export async function peindre(vue, graine = 1) {
  const { image: photo, silhouette, paysage = false, horizon = .66, sombre = false } = vue;
  const W = photo.width, H = photo.height, toile = document.createElement('canvas'); toile.width = W; toile.height = H;
  const gl = toile.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl) throw new Error('Pas de WebGL pour peindre');
  try {
    if ((gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision || 0) < 16) throw new Error('Pas assez de précision pour peindre');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const bruit = texture(gl, hasard(graine), 256, 256, true), img = texture(gl, photo), aplat = texture(gl, null, W, H);
    const contour = texture(gl, halo(silhouette));
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, aplat, 0);
    lier(gl, programme(gl, APLATS), { img, bruit }, W, H);
    gl.viewport(0, 0, W, H); gl.enable(gl.SCISSOR_TEST);
    for (let k = 0, n = 8; k < n; k++) { // par bandes : le téléphone respire entre deux, et la vue continue de tourner
      const y0 = Math.floor(k * H / n), y1 = Math.floor((k + 1) * H / n);
      gl.scissor(0, y0, W, y1 - y0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.flush(); await souffle();
    }
    gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const p = programme(gl, PIGMENT); lier(gl, p, { aplat, halo: contour, bruit }, W, H); gl.uniform3f(gl.getUniformLocation(p, 'papier'), ...PAPIER);
    for (const [nom, v] of [['paysage', +paysage], ['horizon', horizon], ['sombre', +sombre]]) gl.uniform1f(gl.getUniformLocation(p, nom), v);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (gl.isContextLost()) throw new Error('Le pinceau a été interrompu');
    const sortie = document.createElement('canvas'); sortie.width = W; sortie.height = H; sortie.getContext('2d').drawImage(toile, 0, 0);
    return sortie;
  } finally { gl.getExtension('WEBGL_lose_context')?.loseContext(); } // la mémoire de la carte graphique est rendue aussitôt
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
