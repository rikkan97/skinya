/* ====================================================================
   UI.JS — Mικρά UI components (toast, carousel, newsletter)
   --------------------------------------------------------------------
   • showToast(msg)  — αναδυόμενο μήνυμα στο κάτω μέρος της οθόνης
   • subscribeNews() — newsletter form submission (placeholder)
   • Carousel        — το slider με τα 3 collections στην αρχική
   ==================================================================== */

// ───── TOAST ─────
function showToast(msg, variant){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('show','toast-warn');
  void t.offsetWidth;   // force reflow ώστε να ξαναπαίξει το animation
  if(variant === 'warn') t.classList.add('toast-warn');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

// ───── NEWSLETTER ─────
// Αποθηκεύει στο newsletter_subscribers (RLS: anyone can insert).
// Αν ο χρήστης είναι ήδη logged-in, ενημερώνει και το customers.newsletter = true.
async function subscribeNews(){
  const input = document.getElementById('newsEmail');
  const email = (input?.value || '').trim().toLowerCase();
  if(!email || !email.includes('@') || !email.includes('.')){
    showToast('Εισάγετε έγκυρο email');
    return;
  }

  const btn = document.querySelector('.news-form button');
  const originalBtn = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = '…'; }

  try {
    if(!window.sb) throw new Error('Supabase client not loaded');

    // Newsletter list (κύριος προορισμός)
    const { error } = await window.sb
      .from('newsletter_subscribers')
      .insert({ email, source: 'homepage' });

    // 23505 = unique_violation → ήδη εγγεγραμμένος, το θεωρούμε επιτυχία (idempotent UX)
    if(error && error.code !== '23505') throw error;

    // Αν έχει account, σήμανε και το customers.newsletter (RLS: μόνο τον δικό του row)
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if(user){
        await window.sb
          .from('customers')
          .update({ newsletter: true })
          .eq('id', user.id);
      }
    } catch(_){ /* non-fatal */ }

    input.value = '';
    showToast(error?.code === '23505'
      ? 'Είσαι ήδη μέλος του Cercle Skinya ❀'
      : 'Καλώς ήρθες στο Cercle Skinya ❀');
  } catch(err) {
    console.error('[Skinya] newsletter subscribe error:', err);
    showToast('Κάτι πήγε στραβά — δοκίμασε ξανά', 'warn');
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = originalBtn; }
  }
}

// ───── CAROUSEL (δυναμικός αριθμός slides — από site_sections) ─────
let currentSlide = 0;
let totalSlides = 3;
let carouselInterval;

function goToSlide(n){
  if(totalSlides <= 0) return;
  currentSlide = (n + totalSlides) % totalSlides;
  const track = document.getElementById('track');
  if(track){
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  }
  document.querySelectorAll('.dot').forEach((d,i)=>{
    d.classList.toggle('active', i===currentSlide);
  });
}

function startCarousel(){
  if(carouselInterval) clearInterval(carouselInterval);
  if(totalSlides <= 1) return;
  if(_carouselPaused) return;   // ο χρήστης διαβάζει — μην το ξαναπιάσεις
  carouselInterval = setInterval(()=>goToSlide(currentSlide+1), 6000);
}
function stopCarousel(){
  if(carouselInterval){ clearInterval(carouselInterval); carouselInterval = null; }
}

// Pause όσο ο cursor είναι μέσα στο carousel (desktop) ή όταν ο χρήστης
// αγγίξει slide σε mobile — έτσι προλαβαίνει να διαβάσει χωρίς να αλλάζει.
let _carouselPaused = false;
document.addEventListener('DOMContentLoaded', ()=>{
  const car = document.querySelector('.carousel');
  if(!car) return;
  car.addEventListener('mouseenter', ()=>{ _carouselPaused = true; stopCarousel(); });
  car.addEventListener('mouseleave', ()=>{ _carouselPaused = false; startCarousel(); });
  // Mobile: tap κάπου στο slide → pause μόνιμα μέχρι reload (όπως κάνει το home-shop)
  car.addEventListener('pointerdown', e=>{
    // Επίτρεψε τα κουμπιά πλοήγησης (arrows/dots) να αλλάζουν slide χωρίς να σταματούν εντελώς
    if(e.target.closest('.arrow, .dot')) return;
    _carouselPaused = true; stopCarousel();
  });
});

// Καλείται από το renderHomeFavorites μετά το rebuild των slides
window.setCarouselSlides = function(count){
  totalSlides = count;
  currentSlide = 0;
  // re-wire dots (νέα DOM elements μετά το rebuild)
  document.querySelectorAll('.dot').forEach((d,i)=>{
    d.onclick = ()=>{ goToSlide(i); startCarousel(); };
  });
  goToSlide(0);
  startCarousel();
};
