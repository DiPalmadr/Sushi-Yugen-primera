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
  "calif-medio": { nombre: "Medio Rollo", precio: 5.99 },
  "calif-compl": { nombre: "Rollo Completo", precio: 9.99 },
  "dragon-medio": { nombre: "Medio Rollo", precio: 6.49 },
  "dragon-full": { nombre: "Rollo Completo", precio: 9.99 },
  "phil-medio": { nombre: "Medio Rollo", precio: 5.99 },
  "phil-full": { nombre: "Rollo Completo", precio: 9.99 },
  "rain-medio": { nombre: "Medio Rollo", precio: 5.99 },
  "rain-full": { nombre: "Rollo Completo", precio: 9.99 },
  "tiger-medio": { nombre: "Medio Rollo", precio: 6.99 },
  "tiger-full": { nombre: "Rollo Completo", precio: 10.99 },
  "Kani-medio": { nombre: "Medio Rollo", precio: 6.99 },
  "Kani-full": { nombre: "Rollo Completo", precio: 10.99 },
  "sunset-medio": { nombre: "Medio Rollo", precio: 7.99 },
  "sunset-full": { nombre: "Rollo Completo", precio: 11.99 },
  "Ura-medio": { nombre: "Medio Rollo", precio: 6.99 },
  "ura-full": { nombre: "Rollo Completo", precio: 10.99 },
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

function calcularEnvio(subtotal) {
  if (!ENVIO.enabled) return 0;
  if (ENVIO.freeEnabled && subtotal >= ENVIO.freeMin) return 0;
  return ENVIO.amount;
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

// Contador atómico: usa escrituras condicionales de Netlify Blobs, así dos
// pedidos simultáneos nunca reciben el mismo número.
async function siguienteNumeroPedido(event) {
  const blobs = require('@netlify/blobs');
  blobs.connectLambda(event);
  const store = blobs.getStore({ name: 'pedidos', consistency: 'strong' });
  for (let intento = 0; intento < 10; intento++) {
    const actual = await store.getWithMetadata('contador', { type: 'text' });
    if (!actual) {
      const r = await store.set('contador', '1', { onlyIfNew: true });
      if (r.modified) return 1;
      continue;
    }
    const n = (parseInt(actual.data, 10) || 0) + 1;
    const r = await store.set('contador', String(n), { onlyIfMatch: actual.etag });
    if (r.modified) return n;
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
      if (!producto) { desconocidos.push(it.sku); lineas.push('⚠️ SKU desconocido: ' + it.sku + ' x' + qty); return; }
      subtotal += producto.precio * qty;
      lineas.push(qty + 'x ' + producto.nombre + ' — $' + producto.precio.toFixed(2) + ' c/u');
    });
    if (!lineas.length) return { statusCode: 400, body: 'Sin items válidos' };

    const envio = calcularEnvio(subtotal);
    const total = subtotal + envio;

    let numeroPedido = null;
    if (SECUENCIAL) {
      try { numeroPedido = await siguienteNumeroPedido(event); }
      catch (e) { console.error('No se pudo generar el número de pedido:', e); }
    }

    let mensaje = '🔔 Nuevo pedido' + (numeroPedido ? ' #' + numeroPedido : '') + ' (verificación)\n\n' + lineas.join('\n');
    if (ENVIO.enabled) {
      mensaje += '\n\nSubtotal: $' + subtotal.toFixed(2);
      mensaje += '\nEnvío: ' + (envio === 0 ? 'Gratis' : '$' + envio.toFixed(2));
    }
    mensaje += '\n\nTotal real: $' + total.toFixed(2);

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
