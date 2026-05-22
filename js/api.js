/* ====================================================================
   API.JS — Supabase data layer (αντικαθιστά τα local data του data.js)
   --------------------------------------------------------------------
   • loadDataFromSupabase()  — φέρνει products + categories από DB και
                                γεμίζει τα global arrays (products / categories)
   • fetchProductsDB()       — επιστρέφει fresh data από DB
   • fetchCategoriesDB()     — επιστρέφει fresh data από DB
   • mapProduct()/mapCategory() — μετατρέπουν DB rows σε format που
                                  περιμένει το frontend (data.js shape)
   --------------------------------------------------------------------
   Σχήμα DB → Σχήμα Frontend:
     sku            → id
     brand_id       → brand (name via JOIN)
     category_id    → cat
     key_ingredient → keyIng
     tech_name      → tech
     tech_desc      → techDesc
     description    → desc
     is_featured    → featured
   ==================================================================== */

function mapProduct(row){
  // row.brand = { name: 'Anua' } (from JOIN with brands table)
  return {
    id:       row.sku,
    name:     row.name,
    brand:    row.brand?.name || '',
    cat:      row.category_id,
    size:     row.size || '',
    img:      row.img || null,
    keyIng:   row.key_ingredient || '',
    tech:     row.tech_name || '',
    techDesc: row.tech_desc || '',
    desc:     row.description || '',
    featured: !!row.is_featured,
    price:    row.price != null ? Number(row.price) : null,
    defaultPrice: row.default_price != null ? Number(row.default_price) : null,
    stock:    row.stock,
    badges:   Array.isArray(row.badges) ? row.badges : []
  };
}

function mapCategory(row){
  return {
    id:      row.id,
    name:    row.name,
    step:    row.step || '',
    eyebrow: row.eyebrow || '',
    desc:    row.description || ''
  };
}

async function fetchProductsDB(){
  const { data, error } = await window.sb
    .from('products')
    .select('sku, name, brand_id, category_id, size, img, key_ingredient, tech_name, tech_desc, description, price, default_price, stock, is_featured, badges, brand:brands(name)')
    .eq('is_active', true);

  if(error){
    console.error('[Skinya] fetchProductsDB error:', error);
    return [];
  }
  return data.map(mapProduct);
}

async function fetchCategoriesDB(){
  const { data, error } = await window.sb
    .from('categories')
    .select('id, name, step, eyebrow, description, sort_order')
    .order('sort_order');

  if(error){
    console.error('[Skinya] fetchCategoriesDB error:', error);
    return [];
  }
  return data.map(mapCategory);
}

/* --------------------------------------------------------------------
   loadDataFromSupabase
   Καλείται στην αρχή του DOMContentLoaded — γεμίζει τα global arrays
   ΠΡΙΝ ξεκινήσουν τα renders. Αν αποτύχει το DB, διατηρεί το local
   fallback data του data.js.
   -------------------------------------------------------------------- */
async function loadDataFromSupabase(){
  try {
    const [dbProducts, dbCategories] = await Promise.all([
      fetchProductsDB(),
      fetchCategoriesDB(),
      fetchAllSiteSections()
    ]);

    if(dbProducts.length){
      products.splice(0, products.length, ...dbProducts);
    }
    if(dbCategories.length){
      categories.splice(0, categories.length, ...dbCategories);
    }
    const uniqueBrands = new Set(products.map(p=>p.brand).filter(Boolean));
    console.log(`[Skinya] Loaded ${products.length} products, ${categories.length} categories, ${uniqueBrands.size} brands from Supabase ✓`);
    return true;
  } catch(e){
    console.warn('[Skinya] Supabase load απέτυχε — χρησιμοποιώ local fallback:', e);
    return false;
  }
}

// Override των fetchProducts/fetchCategories του data.js ώστε να
// επιστρέφουν fresh data από DB όταν καλούνται direct.
async function fetchProducts(){ return await fetchProductsDB(); }
async function fetchCategories(){ return await fetchCategoriesDB(); }

/* ====================================================================
   SITE SECTIONS — admin-managed UI content
   ==================================================================== */
const _sectionsCache = {};

async function fetchSiteSection(id){
  if(_sectionsCache[id]) return _sectionsCache[id];
  const { data, error } = await window.sb
    .from('site_sections').select('*').eq('id', id).single();
  if(error){ console.warn('[Skinya] fetchSiteSection', id, error); return null; }
  _sectionsCache[id] = data;
  return data;
}

// Φέρε ΟΛΑ τα sections με μία αίτηση — populate window.siteSections map
async function fetchAllSiteSections(){
  const { data, error } = await window.sb
    .from('site_sections').select('id, kind, max_items, items, config');
  if(error){ console.warn('[Skinya] fetchAllSiteSections error:', error); return {}; }
  const map = {};
  for(const s of (data||[])){
    map[s.id] = s;
    _sectionsCache[s.id] = s;
  }
  window.siteSections = map;
  return map;
}

// Map κατηγορίας → ωραίο label για το CTA button
const CAT_LABEL_GENITIVE = {
  cleansers:'Καθαρισμό', toners:'Toners', serums:'Serums', eyes:'Eye Care',
  moisturizers:'Κρέμες', spf:'SPF', masks:'Μάσκες', body:'Body'
};

// Σπάει το όνομα σε «κανονικό» + «em» (τελευταίες 2 λέξεις σε italic)
function splitNameForCarousel(name){
  const parts = (name||'').trim().split(/\s+/);
  if(parts.length <= 2) return { main: '', em: name };
  const em = parts.slice(-2).join(' ');
  const main = parts.slice(0, -2).join(' ');
  return { main, em };
}

async function renderHomeFavorites(){
  const track = document.getElementById('track');
  if(!track) return;

  const section = await fetchSiteSection('home_favorites');
  if(!section || !Array.isArray(section.items) || section.items.length === 0) return;

  // Map SKUs σε full products (από το global products array)
  const productList = section.items
    .map(it => products.find(p => p.id === it.sku))
    .filter(Boolean);

  if(productList.length === 0) return;

  // Render slides
  track.innerHTML = productList.map(p => {
    const { main, em } = splitNameForCarousel(p.name);
    const badges = (p.badges||[])
      .filter(b => !['k-beauty','best-seller'].includes(b))
      .slice(0,2)
      .map(b => (typeof badgeLabels !== 'undefined' && badgeLabels[b]) || b)
      .join(' · ') || 'K-Beauty';
    const ingLabel = p.tech ? (p.tech.length > 22 ? p.tech.split(/[·+]/)[0].trim() : p.tech) : (p.keyIng || '—');
    const catGen   = CAT_LABEL_GENITIVE[p.cat] || 'Προϊόντα';

    return `
      <div class="slide">
        <div class="slide-text">
          <span class="slide-brand">${escapeHTMLSafe(p.brand)}</span>
          <h3>${escapeHTMLSafe(main)} <em>${escapeHTMLSafe(em)}</em></h3>
          <p>${escapeHTMLSafe(p.desc || p.techDesc || p.keyIng || '')}</p>
          <div class="slide-meta">
            <div class="meta-item"><small>Κύριο Συστατικό</small><strong>${escapeHTMLSafe(ingLabel)}</strong></div>
            <div class="meta-item"><small>Μέγεθος</small><strong>${escapeHTMLSafe(p.size||'—')}</strong></div>
            <div class="meta-item"><small>Badges</small><strong>${escapeHTMLSafe(badges)}</strong></div>
          </div>
          <a class="btn-primary" data-route="products" data-cat="${escapeHTMLSafe(p.cat)}"><span>Δες στα ${escapeHTMLSafe(catGen)}</span></a>
        </div>
        <div class="slide-visual">
          <span class="slide-visual-initial">${escapeHTMLSafe((p.brand||'Skinya').charAt(0))}</span>
          ${p.img ? `<img class="slide-img" src="${escapeHTMLSafe(p.img)}" alt="${escapeHTMLSafe(p.brand+' '+p.name)}" onerror="this.remove()">` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Rebuild dots
  const dotsWrap = document.querySelector('.carousel-dots');
  if(dotsWrap){
    dotsWrap.innerHTML = productList.map((_,i)=>
      `<button class="dot${i===0?' active':''}" data-slide="${i}"></button>`
    ).join('');
  }

  // Ενημέρωσε το totalSlides + ξανασύνδεσε τα dots
  if(typeof window.setCarouselSlides === 'function'){
    window.setCarouselSlides(productList.length);
  }
}

function escapeHTMLSafe(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function splitFounderName(name){
  const parts = (name||'').trim().split(/\s+/);
  if(parts.length === 0) return { first:'', em:'' };
  if(parts.length === 1) return { first:'', em: parts[0] };
  return { first: parts.slice(0, -1).join(' '), em: parts[parts.length-1] };
}

// ──────────────────────────────────────────────────────────────
// RENDER ROUTINES — Morning / Night / Weekly
// Ενημερώνει μόνο τα προϊόντα ανά step. Το step copy (title, time, why)
// μένει στατικό στο HTML.
// ──────────────────────────────────────────────────────────────
function applyProductToCfCard(card, p){
  if(!card || !p) return;
  const img    = card.querySelector('.cf-photo img');
  const brand  = card.querySelector('.cf-brand');
  const name   = card.querySelector('.cf-product');
  const cta    = card.querySelector('.cf-cta');
  if(img){
    img.src = p.img || '';
    img.alt = `${p.brand} ${p.name}`;
  }
  if(brand) brand.textContent = p.brand;
  if(name)  name.textContent  = p.name;
  if(cta){
    cta.setAttribute('onclick', `addToCart('${p.id}')`);
  }
}

function applyProductToWeeklyHero(hero, p, editorial){
  if(!hero || !p) return;
  const img   = hero.querySelector('.m-hero-photo img');
  const brand = hero.querySelector('.m-product-brand');
  const name  = hero.querySelector('.m-product-name');
  const ctaPrimary = hero.querySelector('.m-cta-primary');
  const ctaLink    = hero.querySelector('.m-cta-link');
  if(img){
    img.src = p.img || '';
    img.alt = `${p.brand} ${p.name}`;
  }
  if(brand) brand.textContent = p.brand;
  if(name)  name.textContent  = p.name;
  if(ctaPrimary) ctaPrimary.setAttribute('onclick', `viewProduct('${p.id}')`);
  if(ctaLink)    ctaLink.setAttribute('onclick', `addToCart('${p.id}')`);
  applyEditorialToWeeklyHero(hero, editorial);
}

// Εφαρμόζει τα editorial κείμενα του weekly hero (από admin → config.editorial).
// Κάθε πεδίο που είναι κενό αφήνει το hardcoded HTML ως έχει (fallback).
function applyEditorialToWeeklyHero(hero, ed){
  if(!hero || !ed || typeof ed !== 'object') return;
  const setText = (sel, val) => {
    if(val == null || String(val).trim() === '') return;
    const el = hero.querySelector(sel);
    if(el) el.textContent = String(val);
  };

  setText('.m-step-tag', ed.tag);
  setText('.m-step-time', ed.time);
  // m-step-best: κρατάμε το πρόθεμα «Best for: » σταθερό
  if(ed.bestFor != null && String(ed.bestFor).trim() !== ''){
    const best = hero.querySelector('.m-step-best');
    if(best) best.textContent = `Best for: ${ed.bestFor}`;
  }

  // Τίτλος: κανονικό κομμάτι + έμφαση (italic)
  if((ed.title != null && String(ed.title).trim() !== '') ||
     (ed.titleEm != null && String(ed.titleEm).trim() !== '')){
    const h = hero.querySelector('.m-hero-content h3');
    if(h){
      const lead = escapeHTMLSafe(ed.title || '');
      const em   = ed.titleEm ? ` <em>${escapeHTMLSafe(ed.titleEm)}</em>` : '';
      h.innerHTML = lead + em;
    }
  }

  setText('.m-hero-lead', ed.lead);
  setText('.m-result strong', ed.result);

  // Chips: comma-separated → ένα <span class="m-chip"> ανά τιμή
  if(ed.chips != null && String(ed.chips).trim() !== ''){
    const wrap = hero.querySelector('.m-chips');
    if(wrap){
      const chips = String(ed.chips).split(',').map(c => c.trim()).filter(Boolean);
      if(chips.length){
        wrap.innerHTML = chips.map(c => `<span class="m-chip">${escapeHTMLSafe(c)}</span>`).join('');
      }
    }
  }

  // «Γιατί το επιλέξαμε»: κρατάμε το <em> label σταθερό, αλλάζει μόνο το κείμενο
  if(ed.why != null && String(ed.why).trim() !== ''){
    const why = hero.querySelector('.m-why');
    if(why) why.innerHTML = `<em>Γιατί το επιλέξαμε:</em> ${escapeHTMLSafe(ed.why)}`;
  }
}

function applyProductToWeeklyCard(card, p, editorial){
  if(!card || !p) return;
  const img   = card.querySelector('.m-card-visual img');
  const small = card.querySelector('.m-card-pick small');
  const name  = card.querySelector('.m-card-pick strong');
  const cta   = card.querySelector('.m-card-cta');
  if(img){
    img.src = p.img || '';
    img.alt = `${p.brand} ${p.name}`;
  }
  if(small) small.textContent = p.brand;
  if(name)  name.textContent  = p.name;
  if(cta){
    cta.setAttribute('onclick', `addToCart('${p.id}')`);
  }
  applyEditorialToWeeklyCard(card, editorial);
}

// Editorial κείμενα μικρής κάρτας weekly (από admin → config.cards[idx]).
// Κενό πεδίο → κρατάει το hardcoded HTML (fallback).
function applyEditorialToWeeklyCard(card, ed){
  if(!card || !ed || typeof ed !== 'object') return;
  const setText = (sel, val) => {
    if(val == null || String(val).trim() === '') return;
    const el = card.querySelector(sel);
    if(el) el.textContent = String(val);
  };

  setText('.m-card-step', ed.step);
  // m-card-time: κρατάμε το «· » prefix σταθερό
  if(ed.time != null && String(ed.time).trim() !== ''){
    const t = card.querySelector('.m-card-time');
    if(t) t.textContent = `· ${ed.time}`;
  }

  // Τίτλος h4: κανονικό + έμφαση (italic)
  if((ed.title != null && String(ed.title).trim() !== '') ||
     (ed.titleEm != null && String(ed.titleEm).trim() !== '')){
    const h = card.querySelector('h4');
    if(h){
      const lead = escapeHTMLSafe(ed.title || '');
      const em   = ed.titleEm ? ` <em>${escapeHTMLSafe(ed.titleEm)}</em>` : '';
      h.innerHTML = lead + em;
    }
  }

  setText('.m-card-result', ed.result);

  // Chips (comma-separated)
  if(ed.chips != null && String(ed.chips).trim() !== ''){
    const wrap = card.querySelector('.m-chips--sm');
    if(wrap){
      const chips = String(ed.chips).split(',').map(c => c.trim()).filter(Boolean);
      if(chips.length){
        wrap.innerHTML = chips.map(c => `<span class="m-chip">${escapeHTMLSafe(c)}</span>`).join('');
      }
    }
  }

  // «Γιατί το επιλέξαμε»: label σταθερό, αλλάζει το κείμενο
  if(ed.why != null && String(ed.why).trim() !== ''){
    const why = card.querySelector('.m-card-pick p');
    if(why) why.innerHTML = `<em>Γιατί το επιλέξαμε:</em> ${escapeHTMLSafe(ed.why)}`;
  }
}

// Βοηθητικό: παίρνει την effective τιμή προϊόντος (price override → default_price → category default)
function effectivePrice(p){
  if(!p) return 0;
  if(p.price != null && !isNaN(p.price)) return Number(p.price);
  if(p.defaultPrice != null && !isNaN(p.defaultPrice)) return Number(p.defaultPrice);
  // last-resort fallback: getProductPrice από data.js αν υπάρχει
  if(typeof getProductPrice === 'function') return getProductPrice(p);
  return 0;
}

// Fallback SKUs για τα routine bundles — ΜΟΝΟ για offline (όταν λείπει το DB
// section), ώστε το ΣΥΝΟΛΟ να μπορεί να υπολογιστεί. Αφορά «ποια προϊόντα», ΟΧΙ
// ποσοστό. Το ποσοστό έκπτωσης ορίζεται πάντα από το admin (config.discount).
const ROUTINE_BUNDLE_FALLBACK_SKUS = {
  morning_routine: ['cl4','t1','s9','e3','m4','sp1'],
  night_routine:   ['cl1','cl2','t4','s1','s7','e1','m1']
};

// Επιστρέφει τα items ({sku}) + discount ενός bundle.
//  • items    : DB section first, αλλιώς offline fallback SKUs
//  • discount : ΑΠΟΚΛΕΙΣΤΙΚΑ από το admin (site_sections.config.discount).
//               Δέχεται είτε fraction (0.08) είτε ακέραιο ποσοστό (8) → normalize.
function resolveBundle(sectionId){
  const section = window.siteSections?.[sectionId];
  const fallbackSkus = ROUTINE_BUNDLE_FALLBACK_SKUS[sectionId] || [];
  const items = (section?.items?.length)
    ? section.items
    : fallbackSkus.map(sku => ({ sku }));

  let discount = Number(section?.config?.discount);
  if(isNaN(discount) || discount <= 0) discount = 0;
  else if(discount > 1) discount = discount / 100;

  return { items, discount };
}

// Υπολογίζει & ενημερώνει τα bundle prices στο DOM (discount από section.config ή fallback)
function renderBundlePrice(sectionId, btnId, origElId, finalElId){
  const origEl  = document.getElementById(origElId);
  const finalEl = document.getElementById(finalElId);
  const btn     = document.getElementById(btnId);
  if(!origEl || !finalEl) return;

  const { items, discount } = resolveBundle(sectionId);

  const total = items
    .map(it => products.find(p => p.id === it.sku))
    .filter(Boolean)
    .reduce((s, p) => s + effectivePrice(p), 0);

  // Αν δεν μπορεί να υπολογιστεί τίποτα, άσε το placeholder ("—") αντί για "0,00€"
  if(total <= 0) return;

  const discounted = total * (1 - discount);
  const fmt = n => n.toFixed(2).replace('.', ',') + '€';
  const pctLabel = `−${Math.round(discount * 1000) / 10}%`;

  origEl.textContent  = fmt(total);
  finalEl.textContent = fmt(discounted);
  // Strikethrough «αρχικής» τιμής μόνο όταν υπάρχει έκπτωση από το admin
  origEl.style.display = discount > 0 ? '' : 'none';

  if(btn){
    // Button label — δυναμικό από το admin discount
    const span = btn.querySelector('span');
    if(span) span.textContent = discount > 0 ? `Πάρε το σετ · ${pctLabel}` : 'Πάρε το σετ';
    // Badge δίπλα στο bundle — επίσης δυναμικό (όχι hardcoded)
    const badge = btn.closest('.m-bundle-body')?.querySelector('.m-bundle-badge');
    if(badge){
      badge.textContent = pctLabel;
      badge.style.display = discount > 0 ? '' : 'none';
    }
  }
}

// Γεμίζει το marquee photo-strip ενός bundle με τις εικόνες των προϊόντων της ενότητας.
// Αν δεν υπάρχουν αρκετές εικόνες από admin, κρατά τις default hardcoded.
function applyMarquee(selector, prods){
  const track = document.querySelector(selector);
  if(!track) return;
  const imgs = (prods || []).map(p => p?.img).filter(Boolean);
  if(imgs.length < 2) return;
  const set = aria => imgs.map(src =>
    `<img src="${escapeHTMLSafe(src)}" alt="" class="m-marquee-img"${aria ? ' aria-hidden="true"' : ''}>`).join('');
  track.innerHTML = set(false) + set(true);   // διπλό set για seamless loop
}

// Καλείται από bundle buttons (data-driven add — discount διαβάζεται από section)
function addBundleFromSection(sectionId, bundleName){
  const { items, discount } = resolveBundle(sectionId);
  const skus = items.map(it => it.sku).filter(Boolean);
  if(!skus.length){
    if(typeof showToast === 'function') showToast('Δεν βρέθηκε το set');
    return;
  }
  if(typeof addBundle === 'function'){
    addBundle(skus, bundleName, discount);
  }
}
window.addBundleFromSection = addBundleFromSection;

async function renderRoutines(){
  await fetchAllSiteSections();  // ensure cache
  const sections = window.siteSections || {};

  // Ενημέρωσε τα bundle prices (discount διαβάζεται από section.config)
  renderBundlePrice('morning_routine', 'morningBundleBtn', 'morningBundleOriginal', 'morningBundleFinal');
  renderBundlePrice('night_routine',   'nightBundleBtn',   'nightBundleOriginal',   'nightBundleFinal');

  // MORNING
  const morning = sections['morning_routine'];
  if(morning?.items?.length){
    document.querySelectorAll('#morningFan .cf-card[data-index]').forEach((card, idx)=>{
      const p = products.find(x => x.id === morning.items[idx]?.sku);
      if(p) applyProductToCfCard(card, p);
    });
    const mProds = morning.items.map(it => products.find(x => x.id === it.sku)).filter(Boolean);
    applyMarquee('.routine-section--morning .m-marquee-track', mProds);
  }

  // NIGHT
  const night = sections['night_routine'];
  if(night?.items?.length){
    document.querySelectorAll('#nightFan .cf-card[data-index]').forEach((card, idx)=>{
      const p = products.find(x => x.id === night.items[idx]?.sku);
      if(p) applyProductToCfCard(card, p);
    });
    const nProds = night.items.map(it => products.find(x => x.id === it.sku)).filter(Boolean);
    applyMarquee('.routine-section--night .m-marquee-track', nProds);
  }

  // WEEKLY (hero card + 2 grid cards)
  // • Αν το admin (Site UI → weekly) έχει προϊόντα → δείξε ΑΚΡΙΒΩΣ αυτά (κρύψε τα extra).
  // • Αν είναι κενό (ή τα SKU δεν αντιστοιχούν) → άσε τα default hardcoded ως έχουν.
  const weekly = sections['weekly_routine'];
  const findP  = sku => sku ? products.find(x => x.id === sku) : null;
  const show   = (el, on) => { if(el) el.style.display = on ? '' : 'none'; };

  const wItems = (weekly?.items || []).map(it => findP(it.sku)).filter(Boolean);
  if(wItems.length){
    const heroEl = document.querySelector('.routine-weekly .m-hero');
    if(heroEl){ applyProductToWeeklyHero(heroEl, wItems[0], weekly?.config?.editorial); show(heroEl, true); }

    let shownGrid = 0;
    const cardEditorials = weekly?.config?.cards || [];
    document.querySelectorAll('.routine-weekly .m-card[data-step]').forEach((card, idx)=>{
      const p = wItems[idx + 1];
      if(p){ applyProductToWeeklyCard(card, p, cardEditorials[idx]); shownGrid++; show(card, true); }
      else show(card, false);
    });
    show(document.querySelector('.routine-weekly .m-grid'), shownGrid > 0);
  }
}

async function renderFounders(){
  const grid = document.getElementById('foundersGrid');
  if(!grid) return;

  const section = window.siteSections?.['founders'] || await fetchSiteSection('founders');
  if(!section || !Array.isArray(section.items) || section.items.length === 0) return;

  grid.innerHTML = section.items.map((f, idx)=> {
    const { first, em } = splitFounderName(f.name);
    const initial = (f.name||'').charAt(0).toUpperCase() || '·';
    const portraitClass = idx === 0 ? 'founder-portrait--one' : (idx === 1 ? 'founder-portrait--two' : 'founder-portrait--three');
    const hasPhoto = !!f.photo;
    return `
      <article class="founder-card">
        <div class="founder-portrait ${portraitClass}" ${hasPhoto ? `style="background-image:url('${escapeHTMLSafe(f.photo)}');background-size:cover;background-position:center"` : ''}>
          ${hasPhoto ? '' : `<span class="founder-initial">${escapeHTMLSafe(initial)}</span>`}
          <span class="founder-tag">${escapeHTMLSafe(f.role || 'Co-Founder')}</span>
        </div>
        <h3>${escapeHTMLSafe(first)} ${first ? '<em>'+escapeHTMLSafe(em)+'</em>' : escapeHTMLSafe(em)}</h3>
        <p class="founder-bio">${escapeHTMLSafe(f.bio||'')}</p>
      </article>
    `;
  }).join('');
}
