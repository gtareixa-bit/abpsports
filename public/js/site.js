// ABP SPORT — animación de aparición al hacer scroll (sin dependencias)
(function(){
  document.documentElement.classList.add('js-ready');

  var selectores = '.titulo-seccion, .card, .sede-card, .foto-banner, .card-foto, .cta-final .container > *, .hero h1, .hero p, .hero .acciones, .cifra, .testi, .card-publico, .eu-si-podo-sangre .txt';
  var elementos = document.querySelectorAll(selectores);
  elementos.forEach(function(el, i){
    el.classList.add('reveal');
    el.style.setProperty('--i', i % 6);
  });

  if(!('IntersectionObserver' in window)){
    elementos.forEach(function(el){ el.classList.add('visible'); });
    return;
  }

  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  elementos.forEach(function(el){ observer.observe(el); });
})();

// Botón flotante de WhatsApp — se inyecta en todas las páginas (mismo patrón que el carrito),
// así no hay que tocar el HTML de cada una a mano.
document.addEventListener('DOMContentLoaded', function(){
  if(document.querySelector('.whatsapp-flotante')) return;
  var a = document.createElement('a');
  a.href = 'https://wa.me/34683626716?text=' + encodeURIComponent('Hola, quiero probar una clase gratis. ¿Me podéis informar?');
  a.className = 'whatsapp-flotante';
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Habla con ABP Sport por WhatsApp');
  a.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.02 2.67c-7.36 0-13.33 5.97-13.33 13.33 0 2.35.62 4.63 1.79 6.64L2.67 29.33l6.86-1.8a13.27 13.27 0 0 0 6.49 1.65h.01c7.36 0 13.33-5.97 13.33-13.33S23.38 2.67 16.02 2.67zm7.8 18.83c-.33.93-1.9 1.75-2.62 1.83-.7.08-1.36.34-4.6-.96-3.9-1.56-6.4-5.55-6.6-5.81-.19-.26-1.57-2.09-1.57-3.98s1-2.83 1.36-3.22c.35-.38.77-.48 1.03-.48s.52.003.75.014c.24.011.56-.09.87.67.33.79 1.12 2.72 1.22 2.92.1.19.16.42.03.68-.13.26-.19.42-.38.65-.19.23-.4.51-.57.68-.19.19-.39.4-.17.78.23.38 1 1.66 2.16 2.69 1.49 1.32 2.74 1.74 3.13 1.93.39.19.61.16.84-.1.23-.26.98-1.14 1.24-1.53.26-.39.52-.32.87-.19.35.13 2.24 1.06 2.62 1.25.39.19.65.29.74.45.1.16.1.93-.23 1.86z"/></svg>';
  document.body.appendChild(a);
});
