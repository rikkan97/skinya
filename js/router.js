/* ====================================================================
   ROUTER.JS — Αλλαγή σελίδας + cross-page navigation helpers
   --------------------------------------------------------------------
   Μετά το Phase 3 SPA refactor, οι περισσότερες σελίδες είναι standalone
   HTML files (shop.html, routina.html, notes.html, epikoinwnia.html,
   oroi.html, aporrito.html, cookies.html). Στο index.html μένουν μόνο
   οι transactional SPA pages: home, account, checkout, order-confirmed.
   • navigateTo(route): SPA-style swap μέσα στο index.html, fallback σε
     /?goto=ROUTE redirect αν καλείται από standalone page.
   • goToCategory(cat) / goToProduct(id): cross-page deep linking στο
     /shop. Αν είμαστε ήδη εκεί → inline scroll, αλλιώς redirect με
     hash/query, και το shop landing handler (app.js) αναλαμβάνει.
   ==================================================================== */

function navigateTo(route){
  // Standalone pages (shop.html, routina.html κλπ) δεν έχουν τις άλλες
  // SPA-only pages μέσα τους. Αν ο user καλέσει navigateTo('checkout')
  // από εκεί, redirect στο index.html όπου ζει το checkout SPA.
  const target = document.getElementById('page-' + route);
  if(!target){
    const home = document.getElementById('page-home');
    if(!home){
      // Είμαστε σε standalone page — πάμε στο root με query flag
      window.location.href = '/?goto=' + encodeURIComponent(route);
      return;
    }
    // Είμαστε στο index.html αλλά το route δεν υπάρχει — fallback home
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    home.classList.add('active');
  } else {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    target.classList.add('active');
  }

  // Ενημέρωσε ποιό nav link είναι active
  document.querySelectorAll('.nav-links a').forEach(a=>{
    a.classList.toggle('active', a.dataset.route === route);
  });

  // Κλείσε το mobile menu αν είναι ανοιχτό
  document.getElementById('navLinks')?.classList.remove('open');

  // Πήγαινε στην κορυφή της σελίδας
  window.scrollTo({top:0, behavior:'instant'});

  // Ενημέρωσε το URL hash (π.χ. site.com/#products)
  if(location.hash !== '#' + route){
    history.pushState(null, '', '#' + route);
  }

  // Αν πήγαμε στη σελίδα προϊόντων, render το catalog
  if(route === 'products'){
    renderCatalog();
  }
  // Αν πήγαμε στον λογαριασμό, φέρε orders + profile
  if(route === 'account' && typeof loadAccountPage === 'function'){
    loadAccountPage();
  }
  // Σελίδα checkout — γέμισε σύνοψη/totals από το καλάθι
  if(route === 'checkout' && typeof renderCheckout === 'function'){
    renderCheckout();
  }
}

// Όταν ο user πατάει το back/forward button του browser ή ένα anchor link
window.addEventListener('hashchange', ()=>{
  const hash = location.hash.replace('#','');
  // Άδειο hash → home
  if(!hash){ navigateTo('home'); return; }
  // Anchor links (π.χ. #cat-toners) ή unknown hashes → ΟΧΙ route change.
  // Άσε τον browser να κάνει scroll στο anchor.
  if(!document.getElementById('page-' + hash)) return;
  // Μόνο αν υπάρχει αντίστοιχη σελίδα κάνουμε navigate
  navigateTo(hash);
});

/* ====================================================================
   PRODUCT / CATEGORY NAVIGATION HELPERS
   --------------------------------------------------------------------
   Καλούνται από carousel CTAs, search results, concern stages,
   "Δες το προϊόν" buttons σε ΟΛΕΣ τις σελίδες (home/routine/notes/etc).
   • Αν είμαστε ήδη στη σελίδα /shop (page-products): smooth scroll +
     optional highlight στο card.
   • Αλλιώς: redirect στο /shop με hash (cat) ή query (pid). Το shop.html
     στο landing διαβάζει το URL και κάνει scroll αφού το catalog έχει
     ρεντάρει (handler στο app.js, μετά το renderCatalog).
   ==================================================================== */
function _scrollToAnchor(anchor, offset){
  if(!anchor) return;
  const y = anchor.getBoundingClientRect().top + window.scrollY - (offset||100);
  window.scrollTo({top:y, behavior:'smooth'});
}

function goToCategory(cat){
  if(!cat) return;
  if(document.getElementById('page-products')){
    _scrollToAnchor(document.getElementById('cat-' + cat));
    document.querySelectorAll('.cat-link').forEach(l=>{
      l.classList.toggle('active', l.getAttribute('href') === '#cat-' + cat);
    });
    return;
  }
  window.location.href = '/shop#cat-' + cat;
}

function goToProduct(id){
  if(!id) return;
  const cat = (typeof products !== 'undefined') ? (products.find(p=>p.id===id)||{}).cat : null;
  if(document.getElementById('page-products')){
    const card = document.querySelector(`[data-id="${id}"]`);
    const anchor = card || (cat ? document.getElementById('cat-'+cat) : null);
    _scrollToAnchor(anchor);
    if(card){
      card.classList.add('search-highlight');
      setTimeout(()=>card.classList.remove('search-highlight'), 2400);
    }
    return;
  }
  const hash = cat ? '#cat-' + cat : '';
  window.location.href = '/shop?pid=' + encodeURIComponent(id) + hash;
}
