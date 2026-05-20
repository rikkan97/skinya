/* ====================================================================
   UI.JS — Mικρά UI components (toast, carousel, newsletter)
   --------------------------------------------------------------------
   • showToast(msg)  — αναδυόμενο μήνυμα στο κάτω μέρος της οθόνης
   • subscribeNews() — newsletter form submission (placeholder)
   • Carousel        — το slider με τα 3 collections στην αρχική
   ==================================================================== */

// ───── TOAST ─────
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}

// ───── NEWSLETTER ─────
function subscribeNews(){
  const email = document.getElementById('newsEmail').value;
  if(!email || !email.includes('@')){
    showToast('Εισάγετε έγκυρο email');
    return;
  }
  document.getElementById('newsEmail').value = '';
  // ΜΕΛΛΟΝ: fetch('/api/newsletter', {method:'POST', body:JSON.stringify({email})})
  showToast('Καλώς ήρθατε στο Cercle Skinya ❀');
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
  carouselInterval = setInterval(()=>goToSlide(currentSlide+1), 6000);
}

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
