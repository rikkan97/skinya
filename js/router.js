/* ====================================================================
   ROUTER.JS — Αλλαγή σελίδας μέσα στο single-page app
   --------------------------------------------------------------------
   Όλες οι "σελίδες" του site (home, products, ritual, about, journal)
   είναι μέσα στο ΙΔΙΟ index.html, σαν <div class="page" id="page-XXX">.
   Όταν πατήσεις ένα link με data-route="products", αυτή η συνάρτηση
   κρύβει όλα τα άλλα pages και δείχνει μόνο το επιλεγμένο.
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
