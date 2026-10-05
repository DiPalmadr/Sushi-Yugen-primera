// netlify/functions/notificar-pedido.js
// Generado automáticamente por el Landing Builder (tabla de precios incluida).
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

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) return { statusCode: 400, body: 'Sin items' };

    let total = 0;
    const desconocidos = [];
    const lineas = items.map(function (it) {
      const producto = PRECIOS[it.sku];
      if (!producto) { desconocidos.push(it.sku); return '⚠️ SKU desconocido: ' + it.sku + ' x' + it.qty; }
      const subtotal = producto.precio * it.qty;
      total += subtotal;
      return it.qty + 'x ' + producto.nombre + ' — $' + producto.precio.toFixed(2) + ' c/u';
    });

    let mensaje = '🔔 Nuevo pedido (verificación)\n\n' + lineas.join('\n') + '\n\nTotal real: $' + total.toFixed(2);
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
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error interno' };
  }
};
