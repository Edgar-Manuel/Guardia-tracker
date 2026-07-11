// Genera los iconos PNG de la PWA sin dependencias externas: dibuja un reloj
// sobre fondo azul píxel a píxel y codifica el PNG a mano (zlib + CRC).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Codificador PNG mínimo (RGBA de 8 bits, sin filtro) ---
const tablaCRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = tablaCRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

function png(anchura, altura, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(anchura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const filas = Buffer.alloc((anchura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    filas[y * (anchura * 4 + 1)] = 0; // sin filtro
    pixeles.copy(filas, y * (anchura * 4 + 1) + 1, y * anchura * 4, (y + 1) * anchura * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dibujo del icono: fondo azul redondeado + esfera de reloj ---
const FONDO = [24, 79, 149]; // azul oscuro de la paleta
const ACENTO = [57, 135, 229]; // azul claro
const BLANCO = [255, 255, 255];

function dibujar(tam, margenSeguro) {
  const px = Buffer.alloc(tam * tam * 4);
  const c = tam / 2;
  const radioFondo = margenSeguro ? tam / 2 : tam * 0.46;
  const esquina = margenSeguro ? 0 : tam * 0.22;
  const rReloj = tam * (margenSeguro ? 0.3 : 0.33);
  const grosorAro = tam * 0.045;

  const dentroFondo = (x, y) => {
    if (margenSeguro) return true;
    // Rectángulo redondeado centrado
    const dx = Math.abs(x - c) - (radioFondo - esquina);
    const dy = Math.abs(y - c) - (radioFondo - esquina);
    if (dx > esquina || dy > esquina) return false;
    if (dx <= 0 || dy <= 0) return Math.abs(x - c) <= radioFondo && Math.abs(y - c) <= radioFondo;
    return dx * dx + dy * dy <= esquina * esquina;
  };

  // Manecillas: 10:10 clásico (hora hacia arriba-izquierda, minuto hacia arriba-derecha)
  const manecillas = [
    { ang: (-150 * Math.PI) / 180, largo: rReloj * 0.52, grosor: tam * 0.05 },
    { ang: (-60 * Math.PI) / 180, largo: rReloj * 0.72, grosor: tam * 0.04 },
  ];

  const distSegmento = (x, y, ang, largo) => {
    // Distancia del punto al segmento centro→(centro + largo en dirección ang)
    const ex = c + Math.sin(ang) * largo;
    const ey = c + Math.cos(ang) * largo; // eje y hacia abajo; cos para vertical
    const vx = ex - c;
    const vy = ey - c;
    const t = Math.max(0, Math.min(1, ((x - c) * vx + (y - c) * vy) / (vx * vx + vy * vy)));
    const px2 = c + t * vx;
    const py2 = c + t * vy;
    return Math.hypot(x - px2, y - py2);
  };

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const i = (y * tam + x) * 4;
      if (!dentroFondo(x, y)) continue; // transparente
      let color = FONDO;
      const d = Math.hypot(x - c, y - c);
      // Aro de la esfera
      if (Math.abs(d - rReloj) <= grosorAro) color = BLANCO;
      // Marcas de las 12 y las 6
      else if (d < rReloj) {
        color = ACENTO;
        if (d > rReloj * 0.82 && Math.abs(x - c) < tam * 0.02) color = BLANCO;
        for (const m of manecillas) {
          if (distSegmento(x, y, m.ang, m.largo) <= m.grosor / 2) color = BLANCO;
        }
        if (d <= tam * 0.028) color = BLANCO; // eje central
      }
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

mkdirSync(join(raiz, 'public/icons'), { recursive: true });
for (const [nombre, tam, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-180.png', 180, true],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(join(raiz, 'public/icons', nombre), png(tam, tam, dibujar(tam, maskable)));
  console.log('generado', nombre);
}
