/* ====================================================================
   ROUTER.JS — Αλλαγή σελίδας μέσα στο single-page app
   --------------------------------------------------------------------
   Όλες οι "σελίδες" του site (home, products, ritual, about, journal)
   είναι μέσα στο ΙΔΙΟ index.html, σαν <div class="page" id="page-XXX">.
   Όταν πατήσεις ένα link με data-route="products", αυτή η συνάρτηση
   κρύβει όλα τα άλλα pages και δείχνει μόνο το επιλεγμένο.
   ==================================================================== */

function navigateTo(route){
  // Κρύψε όλες τις σελίδες
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));

  // Δείξε τη σελίδα που ζητήθηκε (ή πέσε πίσω στο home)
  const target = document.getElementById('page-' + route);
  if(target){
    target.classList.add('active');
  } else {
    document.getElementById('page-home').classList.add('active');
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
