// netlify/functions/notificar-pedido.js
// Generado automáticamente por el Landing Builder (tabla de precios y
// configuración de envío, distancia y número de pedido incluidas).
// IMPORTANTE: configura TELEGRAM_TOKEN y TELEGRAM_CHAT_ID como variables de
// entorno en Netlify (Site configuration -> Environment variables).
// Nunca escribas el token directamente aquí.

const PRECIOS = {
  "sashimilub": { nombre: "Sashimi Lubina", precio: 3.99 },
  "sashimipul": { nombre: "Sashimi Pulpo y Calamar", precio: 4.99 },
  "sashimisal": { nombre: "Sashimi Salmón", precio: 3.49 },
  "sashimi-pez": { nombre: "Sashimi Pez Mantequilla", precio: 4.99 },
  "sopa-miso": { nombre: "Sopa Miso, tofu y soba", precio: 4.5 },
  "gyoza": { nombre: "Gyoza de cerdo y cebollino a la plancha. (4 unidades)", precio: 3.99 },
  "ramen": { nombre: "Ramen de pollo, verduras y huevo", precio: 4.99 },
  "calif-medio": { nombre: "California Roll — Medio Rollo", precio: 5.99 },
  "calif-compl": { nombre: "California Roll — Rollo Completo", precio: 9.99 },
  "dragon-medio": { nombre: "Dragon Roll — Medio Rollo", precio: 6.49 },
  "dragon-full": { nombre: "Dragon Roll — Rollo Completo", precio: 9.99 },
  "phil-medio": { nombre: "Philadelphia Roll — Medio Rollo", precio: 5.99 },
  "phil-full": { nombre: "Philadelphia Roll — Rollo Completo", precio: 9.99 },
  "rain-medio": { nombre: "Rainbow Roll — Medio Rollo", precio: 5.99 },
  "rain-full": { nombre: "Rainbow Roll — Rollo Completo", precio: 9.99 },
  "tiger-medio": { nombre: "Tiger Eye Roll — Medio Rollo", precio: 6.99 },
  "tiger-full": { nombre: "Tiger Eye Roll — Rollo Completo", precio: 10.99 },
  "Kani-medio": { nombre: "Kani Maracuyá Roll — Medio Rollo", precio: 6.99 },
  "Kani-full": { nombre: "Kani Maracuyá Roll — Rollo Completo", precio: 10.99 },
  "sunset-medio": { nombre: "Sunset Roll — Medio Rollo", precio: 7.99 },
  "sunset-full": { nombre: "Sunset Roll — Rollo Completo", precio: 11.99 },
  "Ura-medio": { nombre: "Uramaki Salmón Tostado Roll — Medio Rollo", precio: 6.99 },
  "ura-full": { nombre: "Uramaki Salmón Tostado Roll — Rollo Completo", precio: 10.99 },
  "combo-2personas": { nombre: "Combo 2 personas (2 rollos clásicos enteros y 2 medios rollos especiales)", precio: 19.99 },
  "combo-3personas": { nombre: "Combo 3 personas (3 rollos clásicos enteros y 3 medios rollos especiales) + 3 gaseosas personales", precio: 27.99 },
  "combo-4personas": { nombre: "Combo 4 personas (5 rollos enteros)", precio: 34.99 },
  "Promo-explo": { nombre: "Promo del Día: Explosión de sabores -  25 Rollitos + 1 orden de Sashimi", precio: 9.99 },
  "Coca-per": { nombre: "Coca Cola personal", precio: 1.99 },
  "Fanta-per": { nombre: "Fanta Personal", precio: 1.99 },
  "Sprite-per": { nombre: "Sprite Personal", precio: 1.99 },
  "aqua-per": { nombre: "Aquarius Manzana Personal", precio: 1.99 },
  "Font-per": { nombre: "Font Vella personal", precio: 1.25 },
  "Vichy-per": { nombre: "Vichy Catalán Personal", precio: 2.25 }
};

// Config. de envío (igual a la que tienes en el panel del Landing Builder).
// Si cambias el valor del envío o el mínimo para envío gratis ahí, vuelve a
// generar esta carpeta para que quede sincronizado.
const ENVIO = {
  "enabled": true,
  "amount": 1.75,
  "freeEnabled": true,
  "freeMin": 20
};

// Distancia y costo ESTIMADO (línea recta entre tu restaurante y la
// ubicación que compartió el cliente). Es solo una referencia: el costo
// real puede ser menor o mayor.
const RESTAURANTE = {
  "enabled": true,
  "lat": -0.3066590421840036,
  "lng": -78.4496321038248,
  "costoPorKm": 0.75
};

// Si es true, cada pedido recibe un número consecutivo guardado en Netlify
// Blobs (requiere el archivo package.json que viene en esta carpeta).
const SECUENCIAL = true;

// Primer número de pedido. Si ya hay pedidos con un número mayor, el contador
// sigue desde el último (nunca repite ni retrocede).
const PEDIDO_INICIAL = 1984;

function calcularEnvio(subtotal) {
  if (!ENVIO.enabled) return 0;
  if (ENVIO.freeEnabled && subtotal >= ENVIO.freeMin) return 0;
  return ENVIO.amount;
}

// Limpia texto que viene del navegador (quita saltos/caracteres raros y acorta).
function limpiar(t, max) {
  const s = String(t == null ? '' : t);
  let out = '';
  for (let i = 0; i < s.length && out.length < max; i++) {
    const c = s.charCodeAt(i);
    out += (c < 32 || c === 127) ? ' ' : s.charAt(i);
  }
  return out.trim();
}

// Distancia en línea recta (fórmula de Haversine), en km.
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const rad = function (d) { return d * Math.PI / 180; };
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Número de pedido consecutivo con Netlify Blobs.
// Cada número se "reserva" creando una llave nueva (n1, n2, n3...) que solo
// puede crearse UNA vez (onlyIfNew), así dos pedidos simultáneos nunca
// reciben el mismo número. La llave "ultimo" es solo una pista para empezar
// cerca (puede estar un poco atrasada; no afecta la exactitud).
async function siguienteNumeroPedido(event) {
  const blobs = require('@netlify/blobs');
  const opciones = { name: 'pedidos' };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    // Opcional: credenciales manuales (solo si el modo automático no funciona)
    opciones.siteID = process.env.BLOBS_SITE_ID;
    opciones.token = process.env.BLOBS_TOKEN;
  } else {
    blobs.connectLambda(event);
  }
  const store = blobs.getStore(opciones);

  let n = PEDIDO_INICIAL;
  try {
    const pista = await store.get('ultimo');
    n = Math.max((parseInt(pista, 10) || 0) + 1, PEDIDO_INICIAL);
  } catch (e) { /* sin pista: se empieza desde el número inicial */ }

  for (let intento = 0; intento < 80; intento++) {
    const r = await store.set('n' + n, new Date().toISOString(), { onlyIfNew: true });
    if (r.modified) {
      try { await store.set('ultimo', String(n)); } catch (e) { /* solo es una pista */ }
      return n;
    }
    n++;
  }
  throw new Error('No se pudo reservar el número de pedido');
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) return { statusCode: 400, body: 'Sin items' };

    let subtotal = 0;
    const desconocidos = [];
    const lineas = [];
    items.forEach(function (it) {
      const qty = Math.floor(Number(it.qty));
      if (!(qty > 0)) return;
      const producto = PRECIOS[it.sku];
      const detalle = limpiar(it.detalle, 300);
      if (!producto) { desconocidos.push(it.sku); lineas.push('• ⚠️ SKU desconocido: ' + limpiar(it.sku, 60) + ' x' + qty); }
      else {
        subtotal += producto.precio * qty;
        lineas.push('• ' + qty + 'x ' + producto.nombre + ' — $' + producto.precio.toFixed(2) + ' c/u');
      }
      if (detalle) lineas.push('    ↳ ' + detalle);
    });
    if (!lineas.length) return { statusCode: 400, body: 'Sin items válidos' };

    const envio = calcularEnvio(subtotal);
    const total = subtotal + envio;

    let numeroPedido = null;
    let falloContador = '';
    if (SECUENCIAL) {
      try { numeroPedido = await siguienteNumeroPedido(event); }
      catch (e) {
        console.error('No se pudo generar el número de pedido:', e);
        falloContador = limpiar((e && (e.name + ': ' + e.message)) || e, 200);
      }
    }

    let mensaje = '🔔 Nuevo pedido' + (numeroPedido ? ' #' + numeroPedido : '') + ' (verificación)\n\n' + lineas.join('\n');
    if (ENVIO.enabled) {
      mensaje += '\n\nSubtotal: $' + subtotal.toFixed(2);
      mensaje += '\nEnvío: ' + (envio === 0 ? 'Gratis' : '$' + envio.toFixed(2));
    }
    mensaje += '\n\nTotal real: $' + total.toFixed(2);

    const ex = (data.extras && typeof data.extras === 'object') ? data.extras : null;
    if (ex) {
      const bloque = [];
      if (ex.direccion) bloque.push('📍 Dirección escrita: ' + limpiar(ex.direccion, 300));
      if (ex.recibe) bloque.push('👤 Recibe: ' + limpiar(ex.recibe, 100));
      if (Array.isArray(ex.opciones) && ex.opciones.length) {
        bloque.push('🍽️ Preferencias: ' + ex.opciones.slice(0, 10).map(function (o) { return limpiar(o, 80); }).join(', '));
      }
      if (ex.notas) bloque.push('📝 Notas del cliente: ' + limpiar(ex.notas, 500));
      if (bloque.length) mensaje += '\n\n' + bloque.join('\n');
    }

    if (RESTAURANTE.enabled) {
      const g = data.geo;
      const geoValida = g && Number.isFinite(g.lat) && Number.isFinite(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180;
      if (geoValida) {
        const km = distanciaKm(RESTAURANTE.lat, RESTAURANTE.lng, g.lat, g.lng);
        mensaje += '\n\n📍 Distancia aprox. (línea recta): ' + km.toFixed(2) + ' km';
        if (RESTAURANTE.costoPorKm > 0) {
          mensaje += '\n💵 Costo de envío estimado: $' + (km * RESTAURANTE.costoPorKm).toFixed(2) + ' (puede ser menor o mayor al costo real)';
        }
        mensaje += '\n🗺️ https://maps.google.com/?q=' + g.lat + ',' + g.lng;
      } else {
        mensaje += '\n\n📍 El cliente no compartió su ubicación (sin distancia).';
      }
    }
    if (desconocidos.length) mensaje += '\n\n⚠️ Atención: hay códigos que no existen en la tabla de precios.';
    if (SECUENCIAL && !numeroPedido) mensaje += '\n\n⚠️ No se pudo asignar número de pedido. Motivo: ' + (falloContador || 'desconocido');
    if (mensaje.length > 4000) mensaje = mensaje.slice(0, 3990) + '…';

    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const resp = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    });
    if (!resp.ok) {
      console.error('Error de Telegram:', await resp.text());
      return { statusCode: 502, body: 'Error al enviar a Telegram' };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, orderNumber: numeroPedido }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
