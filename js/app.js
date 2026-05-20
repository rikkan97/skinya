/* ====================================================================
   APP.JS — Initialization (συνδέει όλα τα κομμάτια μαζί)
   --------------------------------------------------------------------
   Αυτό το αρχείο πρέπει να φορτώνεται ΤΕΛΕΥΤΑΙΟ στο index.html, αφού
   όλα τα άλλα (data, router, cart, catalog, ui).
   Όταν φορτώσει το DOM:
     • Συνδέει τα data-route links με τον router
     • Στήνει το tooltip toggle (info ⓘ button) — desktop hover + mobile tap
     • Συνδέει τα cart buttons (open / close)
     • Mobile menu toggle
     • Carousel controls (αριστερό/δεξί βέλος + dots)
     • Category nav links στα Προϊόντα
     • Initial render (catalog + carousel + cart count)
     • Διαβάζει το URL hash για να ξεκινήσει στη σωστή σελίδα
   ==================================================================== */

/* ====================================================================
   VIEW PRODUCT — navigate στα Προϊόντα και κάνε scroll/highlight
   στην κάρτα με data-id={id}. Ίδιο pattern με search.js.
   ==================================================================== */
function viewProduct(id){
  const onProducts = document.getElementById('page-products')?.classList.contains('active');
  const doScroll = ()=>{
    const card = document.querySelector(`[data-id="${id}"]`);
    if(!card) return;
    const offset = 100;
    const y = card.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({top:y, behavior:'smooth'});
    card.classList.add('search-highlight');
    setTimeout(()=>card.classList.remove('search-highlight'), 2400);
  };
  if(onProducts){
    setTimeout(doScroll, 60);
  } else {
    navigateTo('products');
    setTimeout(doScroll, 220);
  }
}

/* ====================================================================
   SCROLL SPY — Live ενημερώνει το active link στη sticky category-nav
   --------------------------------------------------------------------
   Καθώς ο user κάνει scroll, η κατηγορία που είναι στο επάνω 1/3 του
   viewport γίνεται "active" στη sticky nav. Χρησιμοποιείται scroll
   listener με requestAnimationFrame (πιο reliable από IntersectionObserver
   για live continuous tracking).
   Πρέπει να ξανατρέχει μετά από κάθε renderCatalog (νέα DOM nodes).
   ==================================================================== */
/* ====================================================================
   MORNING FAN — vanilla port του card-stack/fan React component
   --------------------------------------------------------------------
   • Cards absolute-positioned σε arc layout (κέντρο active, side cards
     rotated + translated με depth)
   • Click on side card → makes it active
   • Click on dot, prev/next button, keyboard ←/→, drag swipe → όλα supported
   • Active card lifts + scales up, others tilt back με 3D rotation
   ==================================================================== */

function setupFanCarousel(wrapId){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;

  const stage = wrap.querySelector('.cf-stage');
  const cards = Array.from(wrap.querySelectorAll('.cf-card'));
  const dots = Array.from(wrap.querySelectorAll('.cf-dot'));
  const prevBtn = wrap.querySelector('.cf-nav--prev');
  const nextBtn = wrap.querySelector('.cf-nav--next');
  if(!cards.length) return;

  const N = cards.length;
  let active = 0;

  // Tuning — επηρεάζει την αισθητική του fan
  const cardWidth = 420;       // bigger cards
  const overlap = 0.52;        // ελαφρώς αυξημένο overlap για να μην ξεφεύγουν side cards
  const spreadDeg = 13;        // ανά card rotation
  const depthPx = 130;         // translateZ ανά step
  const tiltX = 9;             // 3D tilt για inactive cards
  const activeLift = 26;
  const activeScale = 1.04;
  const inactiveScale = 0.90;
  const maxOffset = 3;         // max abs offset για visibility (κρύβει cards πέρα απ' αυτό)

  const cardSpacing = Math.round(cardWidth * (1 - overlap));

  // Signed offset με wrap-around (loop)
  function signedOffset(i, act){
    const raw = i - act;
    const alt = raw > 0 ? raw - N : raw + N;
    return Math.abs(alt) < Math.abs(raw) ? alt : raw;
  }

  function update(){
    cards.forEach((card, i)=>{
      const off = signedOffset(i, active);
      const abs = Math.abs(off);
      const visible = abs <= maxOffset;

      if(!visible){
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        card.style.transform = '';
        card.classList.remove('is-active');
        return;
      }
      card.style.opacity = '1';
      card.style.pointerEvents = '';

      const isActive = off === 0;
      const rotZ = off * spreadDeg;
      const x = off * cardSpacing;
      const y = abs * 8 + (isActive ? -activeLift : 0);
      const z = -abs * depthPx;
      const rotX = isActive ? 0 : tiltX;
      const scale = isActive ? activeScale : inactiveScale;
      const zIndex = 100 - abs;

      card.classList.toggle('is-active', isActive);
      card.style.zIndex = String(zIndex);
      card.style.transform =
        `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${scale})`;
    });
    dots.forEach((d, i)=> d.classList.toggle('is-active', i === active));
  }

  function setActive(i){
    active = ((i % N) + N) % N;
    update();
  }
  const goPrev = ()=> setActive(active - 1);
  const goNext = ()=> setActive(active + 1);

  // Click στο card → make active. Αν είναι ήδη active, αγνόησε
  cards.forEach((card, i)=>{
    card.addEventListener('click', (e)=>{
      // αν drag συνέβη, μην εκλάβεις click
      if(card.dataset.dragging === 'true'){
        card.dataset.dragging = '';
        return;
      }
      setActive(i);
    });
  });

  // Dots
  dots.forEach((dot, i)=>{
    dot.addEventListener('click', ()=> setActive(i));
  });

  // Prev/Next
  prevBtn?.addEventListener('click', goPrev);
  nextBtn?.addEventListener('click', goNext);

  // Keyboard (όταν το stage έχει focus)
  stage?.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft'){ e.preventDefault(); goPrev(); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); goNext(); }
  });

  // Drag-to-swipe για το active card
  let dragStartX = 0;
  let dragging = false;
  let dragCard = null;

  function onPointerDown(e){
    const card = e.target.closest('.cf-card.is-active');
    if(!card) return;
    dragging = true;
    dragCard = card;
    dragStartX = (e.touches ? e.touches[0].clientX : e.clientX);
    card.dataset.dragging = '';
  }
  function onPointerMove(e){
    if(!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = x - dragStartX;
    if(Math.abs(dx) > 5) dragCard.dataset.dragging = 'true';
  }
  function onPointerUp(e){
    if(!dragging) return;
    dragging = false;
    const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const dx = x - dragStartX;
    const threshold = Math.min(120, cardWidth * 0.22);
    if(dx > threshold) goPrev();
    else if(dx < -threshold) goNext();
    setTimeout(()=>{ if(dragCard) dragCard.dataset.dragging = ''; dragCard = null; }, 50);
  }
  stage?.addEventListener('mousedown', onPointerDown);
  stage?.addEventListener('touchstart', onPointerDown, {passive:true});
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, {passive:true});
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);

  // Initial render
  update();
  window.addEventListener('resize', update);
}

let _spyScrollHandler = null;
function setupScrollSpy(){
  const sections = Array.from(document.querySelectorAll('.category-section'));
  if(!sections.length) return;

  // Καθάρισε τυχόν παλιό handler ώστε να μην έχουμε διπλά listeners
  if(_spyScrollHandler){
    window.removeEventListener('scroll', _spyScrollHandler);
  }

  let ticking = false;
  function update(){
    // Σημείο αναφοράς: 30% από την κορυφή του viewport (κάτω από sticky nav)
    const triggerY = window.scrollY + window.innerHeight * 0.3;
    let activeId = null;
    for(const s of sections){
      if(s.offsetTop <= triggerY) activeId = s.id.replace('cat-','');
    }
    if(activeId){
      document.querySelectorAll('.cat-link').forEach(link=>{
        link.classList.toggle('active', link.getAttribute('href') === '#cat-'+activeId);
      });
    }
    ticking = false;
  }

  _spyScrollHandler = () => {
    if(!ticking){
      requestAnimationFrame(update);
      ticking = true;
    }
  };
  window.addEventListener('scroll', _spyScrollHandler, {passive:true});
  update(); // initial check
}

document.addEventListener('DOMContentLoaded', async ()=>{

  // ───── Φόρτωση δεδομένων από Supabase (γεμίζει products + categories arrays) ─────
  if (typeof loadDataFromSupabase === 'function') {
    await loadDataFromSupabase();
  }
  // ───── Render admin-managed UI sections ─────
  if (typeof renderHomeFavorites === 'function') {
    await renderHomeFavorites();
  }
  if (typeof renderRoutines === 'function') {
    await renderRoutines();
  }
  if (typeof renderFounders === 'function') {
    await renderFounders();
  }

  // ───── Router: όλα τα [data-route] links ─────
  // Αν το link έχει και data-cat, μετά το navigateTo κάνουμε smooth scroll
  // στο #cat-{id} της κατηγορίας. 150ms delay ώστε να ολοκληρωθεί το render
  // του catalog + η page transition animation.
  document.body.addEventListener('click', (e)=>{
    const target = e.target.closest('[data-route]');
    if(target){
      e.preventDefault();
      const cat = target.dataset.cat;
      navigateTo(target.dataset.route);
      if(cat){
        setTimeout(()=>{
          const anchor = document.getElementById('cat-' + cat);
          if(anchor){
            const offset = 80; // sticky nav height
            const y = anchor.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({top:y, behavior:'smooth'});
            // Mark το αντίστοιχο .cat-link active
            document.querySelectorAll('.cat-link').forEach(l=>{
              l.classList.toggle('active', l.getAttribute('href') === '#cat-' + cat);
            });
          }
        }, 150);
      }
    }
  });

  // ───── Tooltips: tap-toggle σε touch devices ─────
  // Καλύπτει: .info-toggle (στο .key-ing parent), .cert-badge[data-tip], .product-seal[data-tip]
  // Desktop: CSS :hover (στα δύο τελευταία) — εδώ διαχειριζόμαστε touch tap.
  document.body.addEventListener('click', (e)=>{
    // 1) Info button ⓘ → toggle στο .key-ing parent
    const infoBtn = e.target.closest('.info-toggle');
    if(infoBtn){
      e.preventDefault();
      e.stopPropagation();
      const parent = infoBtn.closest('.key-ing');
      document.querySelectorAll('.key-ing.show-tip').forEach(el=>{
        if(el!==parent) el.classList.remove('show-tip');
      });
      if(parent) parent.classList.toggle('show-tip');
      return;
    }
    // 2) Cert-badge / Product-seal → tap toggles .show-tip
    const tipped = e.target.closest('.cert-badge[data-tip], .product-seal[data-tip]');
    if(tipped){
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.cert-badge.show-tip, .product-seal.show-tip').forEach(el=>{
        if(el!==tipped) el.classList.remove('show-tip');
      });
      tipped.classList.toggle('show-tip');
      return;
    }
    // 3) Κλικ εκτός tooltip → κλείσε όλα τα ανοιχτά
    if(!e.target.closest('.tooltip')){
      document.querySelectorAll('.key-ing.show-tip,.cert-badge.show-tip,.product-seal.show-tip')
        .forEach(el=>el.classList.remove('show-tip'));
    }
  });

  // ───── Cart buttons ─────
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // ───── Mobile menu ─────
  document.getElementById('menuToggle').addEventListener('click', ()=>{
    document.getElementById('navLinks').classList.toggle('open');
  });

  // ───── Carousel controls ─────
  document.getElementById('prevBtn')?.addEventListener('click', ()=>{
    goToSlide(currentSlide-1);
    startCarousel();
  });
  document.getElementById('nextBtn')?.addEventListener('click', ()=>{
    goToSlide(currentSlide+1);
    startCarousel();
  });
  document.querySelectorAll('.dot').forEach((d,i)=>{
    d.addEventListener('click', ()=>{
      goToSlide(i);
      startCarousel();
    });
  });

  // ───── Category nav links (event delegation — δουλεύει και για dynamic .cat-link) ─────
  document.body.addEventListener('click', (e)=>{
    const link = e.target.closest('.cat-link');
    if(link){
      document.querySelectorAll('.cat-link').forEach(l=>l.classList.remove('active'));
      link.classList.add('active');
    }
  });

  // ───── Journal categories (visual only) ─────
  document.querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ───── Concern Match — hover/focus preview + auto-cycle carousel + progress bar ─────
  //   • Auto-cycle: εναλλάσσει τα 5 concerns κάθε 7s με smooth crossfade
  //   • Progress bar (.concern-stage-progress span): inline animation, restart on each tick
  //   • Hover/focus σε row → pause + lock + set active
  //   • Mouseleave από το section → resume (restart bar from 0)
  //   • Click → πέφτει στον υπάρχοντα [data-route] handler (navigate + scroll)
  //   • prefers-reduced-motion: skip το auto-cycle, μένει στο default (1ο concern)
  const concernMatch = document.querySelector('.concern-match');
  if(concernMatch){
    const rows = Array.from(concernMatch.querySelectorAll('.concern-row[data-concern]'));
    const stages = Array.from(concernMatch.querySelectorAll('.concern-stage[data-concern]'));
    const concerns = rows.map(r=>r.dataset.concern);
    const progressBar = concernMatch.querySelector('.concern-stage-progress span');
    const setActive = (concern)=>{
      rows.forEach(r=>r.classList.toggle('is-active', r.dataset.concern===concern));
      stages.forEach(s=>s.classList.toggle('is-active', s.dataset.concern===concern));
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cycleTimer = null;
    let cycleIndex = 0;
    const CYCLE_MS = 7000;

    // Restart το CSS animation καθαρά (inline style + reflow trick)
    const restartProgress = ()=>{
      if(!progressBar) return;
      progressBar.style.animation = 'none';
      void progressBar.offsetWidth; // force reflow
      progressBar.style.animation = `concernProgress ${CYCLE_MS}ms linear forwards`;
      progressBar.style.animationPlayState = 'running';
    };
    const pauseProgress = ()=>{
      if(progressBar) progressBar.style.animationPlayState = 'paused';
    };

    // Vertical row bar — fills top→bottom στο active row, σύγχρονο με το cycle
    // (Opacity fade διαχειρίζεται την εμφάνιση/εξαφάνιση μέσω CSS .is-active toggle.
    //  Το JS controlled μόνο τη fill animation στο active row.)
    const cycleActiveRowBar = ()=>{
      const bar = rows[cycleIndex]?.querySelector('.concern-row-bar');
      if(!bar) return;
      bar.style.animation = 'none';
      bar.style.transform = 'scaleY(0)';
      void bar.offsetWidth; // reflow
      bar.style.animation = `concernRowFill ${CYCLE_MS}ms linear forwards`;
      bar.style.transform = ''; // let animation drive it
      bar.style.animationPlayState = 'running';
    };
    const lockActiveRowBar = ()=>{
      const bar = rows[cycleIndex]?.querySelector('.concern-row-bar');
      if(!bar) return;
      bar.style.animation = 'none';
      bar.style.transform = 'scaleY(1)';
    };
    const pauseActiveRowBar = ()=>{
      const bar = rows[cycleIndex]?.querySelector('.concern-row-bar');
      if(bar) bar.style.animationPlayState = 'paused';
    };
    const resetAllRowBars = ()=>{
      rows.forEach(r=>{
        const bar = r.querySelector('.concern-row-bar');
        if(!bar) return;
        bar.style.animation = 'none';
        bar.style.transform = 'scaleY(0)';
      });
    };

    const tick = ()=>{
      cycleIndex = (cycleIndex + 1) % concerns.length;
      setActive(concerns[cycleIndex]);
      restartProgress();
      cycleActiveRowBar();
    };
    const startCycle = ()=>{
      if(prefersReducedMotion || cycleTimer) return;
      restartProgress();
      cycleActiveRowBar();
      cycleTimer = setInterval(tick, CYCLE_MS);
    };
    const stopCycle = ()=>{
      if(cycleTimer){ clearInterval(cycleTimer); cycleTimer = null; }
      pauseProgress();
      pauseActiveRowBar();
    };

    rows.forEach((row,i)=>{
      const onSelect = ()=>{
        stopCycle();
        resetAllRowBars();
        cycleIndex = i;
        setActive(row.dataset.concern);
        lockActiveRowBar(); // hover lock = full bar (static)
      };
      row.addEventListener('mouseenter', onSelect);
      row.addEventListener('focus', onSelect);
    });
    // Resume όταν φεύγει το mouse από όλο το section
    concernMatch.addEventListener('mouseleave', startCycle);

    // Kick off
    startCycle();
  }

  // ───── HOME SHOP — Tabbed product showcase (8 categories, 3 cards, auto-cycle 3s, smooth crossfade, hover-to-switch) ─────
  const homeShopTabs = document.getElementById('homeShopTabs');
  const homeShopGrid = document.getElementById('homeShopGrid');
  const homeShopMoreLink = document.getElementById('homeShopMoreLink');
  if(homeShopTabs && homeShopGrid && typeof categories !== 'undefined' && typeof products !== 'undefined'){
    const FADE_MS = 750;
    const CYCLE_MS = 4200;

    // Hero products ανά κατηγορία — πρώτα ψάχνει admin-managed section, μετά fallback σε featured
    const pickThree = (catId)=>{
      const section = window.siteSections?.['home_shop_' + catId];
      if(section && Array.isArray(section.items) && section.items.length){
        const ordered = section.items
          .map(it => products.find(p => p.id === it.sku))
          .filter(Boolean);
        if(ordered.length) return ordered.slice(0, section.max_items || 4);
      }
      // Fallback: featured first, then rest
      const items = products.filter(p=>p.cat===catId);
      const featured = items.find(p=>p.featured);
      const rest = items.filter(p=>!p.featured);
      const ordered = featured ? [featured, ...rest] : items;
      return ordered.slice(0,3);
    };
    // Render tabs
    homeShopTabs.innerHTML = categories.map((cat,i)=>
      `<button type="button" class="home-shop-tab${i===0?' is-active':''}" data-cat="${cat.id}" role="tab">
        <span class="home-shop-tab-step">${cat.step}</span>${cat.eyebrow}
      </button>`
    ).join('');

    let currentCat = null;
    let swapTimer = null;
    // Smooth crossfade right→left: fade out + glide αριστερά → swap → snap δεξιά (αόρατο) → fade in
    const setActiveTab = (catId)=>{
      if(catId === currentCat) return;
      currentCat = catId;
      homeShopTabs.querySelectorAll('.home-shop-tab').forEach(t=>{
        t.classList.toggle('is-active', t.dataset.cat === catId);
      });
      if(homeShopMoreLink) homeShopMoreLink.dataset.cat = catId;

      const firstRender = !homeShopGrid.children.length;
      if(firstRender){
        homeShopGrid.innerHTML = pickThree(catId).map(renderMiniCard).join('');
        return;
      }

      if(swapTimer) clearTimeout(swapTimer);
      // 1) Έξοδος: fade out + slide αριστερά
      homeShopGrid.classList.remove('is-snap');
      homeShopGrid.classList.add('is-out');
      // 2) Μετά τη μετάβαση, swap και start από τα δεξιά
      swapTimer = setTimeout(()=>{
        homeShopGrid.innerHTML = pickThree(catId).map(renderMiniCard).join('');
        homeShopGrid.classList.remove('is-out');
        homeShopGrid.classList.add('is-snap'); // snap στα δεξιά χωρίς transition
        // 3) Επόμενο frame: αφαίρεσε snap → transition προς το κέντρο (right→left motion)
        requestAnimationFrame(()=>{
          requestAnimationFrame(()=>{
            homeShopGrid.classList.remove('is-snap');
          });
        });
      }, 750);
    };
    setActiveTab(categories[0].id);

    // Auto-cycle 3 sec (pause on hover)
    let homeShopIdx = 0;
    let homeShopTimer = null;
    const startHomeShopCycle = ()=>{
      if(homeShopTimer) return;
      homeShopTimer = setInterval(()=>{
        homeShopIdx = (homeShopIdx + 1) % categories.length;
        setActiveTab(categories[homeShopIdx].id);
      }, CYCLE_MS);
    };
    const stopHomeShopCycle = ()=>{
      if(homeShopTimer){ clearInterval(homeShopTimer); homeShopTimer = null; }
    };

    // Hover/click σε tab → άμεση αλλαγή (ίδιο pattern με Skinya Diagnostic)
    const tabSelectHandler = (e)=>{
      const tab = e.target.closest('.home-shop-tab');
      if(!tab) return;
      stopHomeShopCycle();
      homeShopIdx = categories.findIndex(c=>c.id===tab.dataset.cat);
      setActiveTab(tab.dataset.cat);
    };
    homeShopTabs.addEventListener('mouseover', tabSelectHandler);
    homeShopTabs.addEventListener('click', tabSelectHandler);

    // Resume cycle όταν φύγει το mouse από το section
    const homeShopSection = homeShopTabs.closest('.home-shop');
    if(homeShopSection){
      homeShopSection.addEventListener('mouseleave', startHomeShopCycle);
    }

    // Kick off
    startHomeShopCycle();
  }

  // ───── Contact form ─────
  // Απλή client-side validation + showToast. Στο production θα στείλει
  // POST σε endpoint (π.χ. /api/contact). Εδώ προσομοιώνουμε την επιτυχία.
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(contactForm);
      const name = (fd.get('name')||'').trim();
      const email = (fd.get('email')||'').trim();
      const topic = (fd.get('topic')||'').trim();
      const message = (fd.get('message')||'').trim();
      const agree = contactForm.querySelector('input[name="agree"]').checked;

      // basic guards
      if(!name || !email || !message){
        showToast('Συμπλήρωσε τα υποχρεωτικά πεδία');
        return;
      }
      if(!topic){
        showToast('Επίλεξε θέμα από τη λίστα');
        return;
      }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        showToast('Εισάγετε έγκυρο email');
        return;
      }
      if(!agree){
        showToast('Παρακαλώ αποδέξου την Πολιτική Απορρήτου');
        return;
      }

      // pretend-send + UX feedback
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Αποστολή…</span>';

      setTimeout(()=>{
        showToast(`Σε ευχαριστούμε ${name.split(' ')[0]} ❀ — απαντάμε σύντομα`);
        contactForm.reset();
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }, 700);
    });
  }

  // ───── Search overlay ─────
  if(typeof setupSearch === 'function') setupSearch();

  // ───── Cookie consent banner ─────
  // Εμφανίζεται μόνο αν δεν έχει αποθηκευτεί επιλογή στο localStorage.
  // Επιλογές: 'all' (accept), 'necessary' (reject). "Reset" κουμπί στο cookies page.
  const cookieBanner = document.getElementById('cookieBanner');
  if(cookieBanner){
    const STORAGE_KEY = 'skinya_cookie_consent';
    const showBanner = ()=>{
      cookieBanner.hidden = false;
      requestAnimationFrame(()=>cookieBanner.classList.add('is-visible'));
    };
    const hideBanner = ()=>{
      cookieBanner.classList.remove('is-visible');
      setTimeout(()=>{cookieBanner.hidden = true;}, 500);
    };
    const saveConsent = (value)=>{
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({choice:value, ts:Date.now()})); } catch(e){}
    };
    // Δείξε banner μόνο αν δεν έχει αποθηκευμένη επιλογή
    try {
      if(!localStorage.getItem(STORAGE_KEY)) setTimeout(showBanner, 800);
    } catch(e){ setTimeout(showBanner, 800); }

    document.getElementById('cookieAccept')?.addEventListener('click', ()=>{
      saveConsent('all'); hideBanner();
    });
    document.getElementById('cookieReject')?.addEventListener('click', ()=>{
      saveConsent('necessary'); hideBanner();
    });
    // Reset κουμπί στο cookies page → ξεκαθαρίζει επιλογή & ξανα-εμφανίζει banner
    document.getElementById('cookieReset')?.addEventListener('click', ()=>{
      try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
      showBanner();
    });
  }

  // ───── Initial render ─────
  renderCatalog();
  startCarousel();
  updateCart();
  setupScrollSpy();
  setupFanCarousel('morningFan');
  setupFanCarousel('nightFan');

  // ───── Διάβασε URL hash για initial route ─────
  // Anchors (π.χ. #cat-toners) δεν είναι routes — αγνόησέ τα εδώ.
  const initialHash = location.hash.replace('#','');
  const isPageRoute = initialHash && document.getElementById('page-' + initialHash);
  if(isPageRoute){
    navigateTo(initialHash);
  } else {
    document.querySelectorAll('.nav-links a').forEach(a=>{
      a.classList.toggle('active', a.dataset.route === 'home');
    });
  }
});
