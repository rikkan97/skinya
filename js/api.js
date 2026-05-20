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
    .from('site_sections').select('id, kind, max_items, items');
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
        <div class="slide-visual"><img class="slide-img" src="${escapeHTMLSafe(p.img||'')}" alt="${escapeHTMLSafe(p.brand+' '+p.name)}"></div>
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

function applyProductToWeeklyHero(hero, p){
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
}

function applyProductToWeeklyCard(card, p){
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
}

async function renderRoutines(){
  await fetchAllSiteSections();  // ensure cache
  const sections = window.siteSections || {};

  // MORNING
  const morning = sections['morning_routine'];
  if(morning?.items?.length){
    const cards = document.querySelectorAll('#morningFan .cf-card[data-index]');
    cards.forEach((card, idx)=>{
      const sku = morning.items[idx]?.sku;
      if(!sku) return;
      const p = products.find(x => x.id === sku);
      if(p) applyProductToCfCard(card, p);
    });
  }

  // NIGHT
  const night = sections['night_routine'];
  if(night?.items?.length){
    const cards = document.querySelectorAll('#nightFan .cf-card[data-index]');
    cards.forEach((card, idx)=>{
      const sku = night.items[idx]?.sku;
      if(!sku) return;
      const p = products.find(x => x.id === sku);
      if(p) applyProductToCfCard(card, p);
    });
  }

  // WEEKLY (hero card + 2 grid cards)
  const weekly = sections['weekly_routine'];
  if(weekly?.items?.length){
    // 1st item → hero
    const hero = document.querySelector('.routine-weekly .m-hero');
    const heroSku = weekly.items[0]?.sku;
    if(hero && heroSku){
      const p = products.find(x => x.id === heroSku);
      if(p) applyProductToWeeklyHero(hero, p);
    }
    // 2nd & 3rd → grid cards (data-step="02", "03")
    const gridCards = document.querySelectorAll('.routine-weekly .m-card[data-step]');
    gridCards.forEach((card, idx)=>{
      const sku = weekly.items[idx + 1]?.sku;
      if(!sku) return;
      const p = products.find(x => x.id === sku);
      if(p) applyProductToWeeklyCard(card, p);
    });
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
