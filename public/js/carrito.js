// ABP SPORT — Carrito de compra (tienda de equipación)
// Sin backend: guarda en localStorage y envía el pedido por Formspree (mismo patrón low-cost que el resto de la web).
// El pago/entrega se confirma manualmente con el club (Bizum / efectivo / Stripe) tras recibir el pedido.
(function(){
  var CART_KEY = 'abp_carrito_v1';

  function getCarrito(){
    try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch(e){ return []; }
  }
  function guardarCarrito(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    render();
  }
  function claveItem(id, variante){ return id + '::' + (variante || ''); }

  function añadir(producto){
    var items = getCarrito();
    var existente = items.find(function(i){ return claveItem(i.id, i.variante) === claveItem(producto.id, producto.variante); });
    if(existente){ existente.cantidad += 1; }
    else{ items.push(Object.assign({cantidad:1}, producto)); }
    guardarCarrito(items);
    abrir();
  }
  function cambiarCantidad(id, variante, delta){
    var items = getCarrito();
    var it = items.find(function(i){ return claveItem(i.id, i.variante) === claveItem(id, variante); });
    if(!it) return;
    it.cantidad += delta;
    if(it.cantidad <= 0){ items = items.filter(function(i){ return i !== it; }); }
    guardarCarrito(items);
  }
  function quitar(id, variante){
    var items = getCarrito().filter(function(i){ return claveItem(i.id, i.variante) !== claveItem(id, variante); });
    guardarCarrito(items);
  }
  function total(){
    return getCarrito().reduce(function(acc, i){ return acc + (i.precio * i.cantidad); }, 0);
  }
  function totalUnidades(){
    return getCarrito().reduce(function(acc, i){ return acc + i.cantidad; }, 0);
  }

  // ---- UI ----
  function crearUI(){
    if(document.querySelector('.carrito-overlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'carrito-overlay';
    var drawer = document.createElement('div');
    drawer.className = 'carrito-drawer';
    drawer.innerHTML =
      '<div class="carrito-cab"><h3>Tu carrito</h3><button class="carrito-cerrar" aria-label="Cerrar">&times;</button></div>' +
      '<div class="carrito-items"></div>' +
      '<div class="carrito-pie">' +
        '<div class="carrito-total"><span>Total</span><span class="carrito-total-num">0,00 €</span></div>' +
        '<a href="tienda.html#checkout" class="btn btn-primario btn-ir-checkout">Finalizar pedido</a>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    overlay.addEventListener('click', cerrar);
    drawer.querySelector('.carrito-cerrar').addEventListener('click', cerrar);
    drawer.querySelector('.btn-ir-checkout').addEventListener('click', function(){
      setTimeout(cerrar, 50);
    });

    // Botón carrito en el header (se inserta si no existe)
    var navWrap = document.querySelector('.nav-wrap');
    if(navWrap && !navWrap.querySelector('.cart-toggle')){
      var btn = document.createElement('button');
      btn.className = 'cart-toggle';
      btn.setAttribute('aria-label', 'Ver carrito');
      btn.innerHTML = '🛒<span class="cart-badge" style="display:none;">0</span>';
      btn.addEventListener('click', abrir);
      var toggle = navWrap.querySelector('.menu-toggle');
      if(toggle){ navWrap.insertBefore(btn, toggle); }
      else{ navWrap.appendChild(btn); }
    }
  }

  function abrir(){
    document.querySelector('.carrito-overlay').classList.add('abierto');
    document.querySelector('.carrito-drawer').classList.add('abierto');
  }
  function cerrar(){
    document.querySelector('.carrito-overlay').classList.remove('abierto');
    document.querySelector('.carrito-drawer').classList.remove('abierto');
  }

  function formatoPrecio(n){ return n.toFixed(2).replace('.', ',') + ' €'; }

  function render(){
    var items = getCarrito();
    var badges = document.querySelectorAll('.cart-badge');
    var n = totalUnidades();
    badges.forEach(function(b){
      b.textContent = n;
      b.style.display = n > 0 ? 'flex' : 'none';
    });

    var cont = document.querySelector('.carrito-items');
    if(cont){
      if(items.length === 0){
        cont.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío.<br>Añade equipación desde la tienda.</p>';
      } else {
        cont.innerHTML = items.map(function(i){
          return '<div class="carrito-item">' +
            '<img src="' + i.img + '" alt="' + i.nombre + '">' +
            '<div class="datos">' +
              '<strong>' + i.nombre + '</strong>' +
              (i.variante ? '<span>' + i.variante + '</span><br>' : '') +
              formatoPrecio(i.precio) +
              '<div class="cantidad">' +
                '<button data-accion="menos" data-id="' + i.id + '" data-variante="' + (i.variante||'') + '">−</button>' +
                '<span>' + i.cantidad + '</span>' +
                '<button data-accion="mas" data-id="' + i.id + '" data-variante="' + (i.variante||'') + '">+</button>' +
              '</div>' +
              '<button class="quitar" data-accion="quitar" data-id="' + i.id + '" data-variante="' + (i.variante||'') + '">Quitar</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }
    var totalNum = document.querySelector('.carrito-total-num');
    if(totalNum) totalNum.textContent = formatoPrecio(total());

    renderResumenCheckout();
  }

  function renderResumenCheckout(){
    var resumen = document.querySelector('.resumen-pedido-lista');
    var resumenTotal = document.querySelector('.resumen-pedido-total');
    var campoOculto = document.querySelector('#pedido_detalle');
    if(!resumen) return;
    var items = getCarrito();
    if(items.length === 0){
      resumen.innerHTML = '<li>No hay productos en el carrito todavía.</li>';
    } else {
      resumen.innerHTML = items.map(function(i){
        return '<li><span>' + i.cantidad + '× ' + i.nombre + (i.variante ? ' (' + i.variante + ')' : '') + '</span><span>' + formatoPrecio(i.precio * i.cantidad) + '</span></li>';
      }).join('');
    }
    if(resumenTotal) resumenTotal.textContent = formatoPrecio(total());
    if(campoOculto){
      campoOculto.value = items.map(function(i){
        return i.cantidad + 'x ' + i.nombre + (i.variante ? ' (' + i.variante + ')' : '') + ' — ' + formatoPrecio(i.precio * i.cantidad);
      }).join('\n') + '\nTOTAL: ' + formatoPrecio(total());
    }
  }

  document.addEventListener('click', function(e){
    var t = e.target;
    if(t.matches('.btn-add-carrito')){
      e.preventDefault();
      var productoEl = t.closest('.producto');
      var variante = '';
      var select = productoEl ? productoEl.querySelector('select') : null;
      if(select) variante = select.value;
      añadir({
        id: t.dataset.id,
        nombre: t.dataset.nombre,
        precio: parseFloat(t.dataset.precio),
        img: t.dataset.img,
        variante: variante
      });
    }
    if(t.dataset && t.dataset.accion === 'mas'){ cambiarCantidad(t.dataset.id, t.dataset.variante, 1); }
    if(t.dataset && t.dataset.accion === 'menos'){ cambiarCantidad(t.dataset.id, t.dataset.variante, -1); }
    if(t.dataset && t.dataset.accion === 'quitar'){ quitar(t.dataset.id, t.dataset.variante); }
  });

  document.addEventListener('DOMContentLoaded', function(){
    crearUI();
    render();

    // Pedido enviado con éxito -> vaciar carrito y avisar
    if(location.search.indexOf('pedido=enviado') !== -1){
      localStorage.removeItem(CART_KEY);
      var aviso = document.querySelector('#aviso-pedido-enviado');
      if(aviso) aviso.style.display = 'block';
      render();
    }
  });
})();
