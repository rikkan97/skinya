/* ====================================================================
   SEARCH.JS — Live αναζήτηση προϊόντων από το search icon στο header
   --------------------------------------------------------------------
   • Open: click στο #searchBtn (focus στο input)
   • Close: ESC, click στο backdrop, click στο ✕, click σε αποτέλεσμα
   • Filter: case + accent insensitive (Ελληνικά + Αγγλικά)
   • Πεδία match: brand + name + keyIng + tech
   • Click result → navigateTo('products') + smooth scroll στην κάρτα
     με data-id, και προσθέτει .search-highlight για 2.2s pulse
   ==================================================================== */

let _searchOpened = false;

function openSearch(){
  const ov = document.getElementById('searchOverlay');
  if(!ov) return;
  ov.classList.add('open');
  ov.setAttribute('aria-hidden','false');
  _searchOpened = true;
  document.body.style.overflow = 'hidden';
  // μικρό delay ώστε να ολοκληρωθεί το transition πριν το focus
  setTimeout(()=>document.getElementById('searchInput')?.focus(), 60);
}

function closeSearch(){
  const ov = document.getElementById('searchOverlay');
  if(!ov) return;
  ov.classList.remove('open');
  ov.setAttribute('aria-hidden','true');
  _searchOpened = false;
  document.body.style.overflow = '';
  const input = document.getElementById('searchInput');
  if(input) input.value = '';
  renderSearchResults('');
}

// Lowercase + strip combining diacritics (Greek τόνοι / Latin accents)
function normalizeSearch(s){
  return (s||'').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .trim();
}

function searchProducts(query){
  const q = normalizeSearch(query);
  if(!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if(!tokens.length) return [];
  return products.filter(p=>{
    const haystack = normalizeSearch(`${p.brand||''} ${p.name||''} ${p.keyIng||''} ${p.tech||''}`);
    return tokens.every(t => haystack.includes(t));
  }).slice(0, 14);
}

// Highlight matched substrings στο name (visual relevance feedback)
function highlightMatch(name, query){
  const tokens = normalizeSearch(query).split(/\s+/).filter(t=>t.length>=2);
  if(!tokens.length) return name;
  // Δεν αλλάζουμε το original string visually· κάνουμε case+accent insensitive match
  // μέσω parallel normalized index → προσθέτουμε <mark> γύρω από τα match ranges.
  const norm = normalizeSearch(name);
  const ranges = [];
  tokens.forEach(t=>{
    let idx = 0;
    while((idx = norm.indexOf(t, idx)) !== -1){
      ranges.push([idx, idx + t.length]);
      idx += t.length;
    }
  });
  if(!ranges.length) return name;
  // merge overlapping
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged = [ranges[0]];
  for(let i=1;i<ranges.length;i++){
    const last = merged[merged.length-1];
    if(ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
    else merged.push(ranges[i]);
  }
  let out = '';
  let cursor = 0;
  merged.forEach(([s,e])=>{
    out += escapeHTML(name.slice(cursor, s));
    out += '<mark>' + escapeHTML(name.slice(s, e)) + '</mark>';
    cursor = e;
  });
  out += escapeHTML(name.slice(cursor));
  return out;
}

function escapeHTML(s){
  return (s||'').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function renderSearchResults(query){
  const out = document.getElementById('searchResults');
  if(!out) return;
  const q = (query||'').trim();
  if(!q){
    out.innerHTML = '<p class="search-empty">Ξεκίνα να γράφεις όνομα προϊόντος ή brand…</p>';
    return;
  }
  const results = searchProducts(q);
  if(!results.length){
    out.innerHTML = `<p class="search-empty">Κανένα αποτέλεσμα για «${escapeHTML(q)}»</p>`;
    return;
  }
  out.innerHTML = `
    <ul class="search-results-list">
      ${results.map(p=>{
        const cat = (typeof categories !== 'undefined') ? categories.find(c=>c.id===p.cat) : null;
        const offer = (typeof getProductOffer === 'function') ? getProductOffer(p) : { price: getProductPrice(p), hasOffer:false };
        const visual = p.img
          ? `<img src="${p.img}" alt="${escapeHTML(p.brand)} ${escapeHTML(p.name)}" loading="lazy">`
          : `<span class="search-result-initial">${escapeHTML((p.brand||'?').charAt(0))}</span>`;
        const soldOut = (typeof isSoldOut === 'function') && isSoldOut(p);
        const priceInner = offer.hasOffer
          ? `<s>${offer.original.toFixed(2)}€</s> <b>${offer.price.toFixed(2)}€</b>`
          : `${offer.price.toFixed(2)}€`;
        const priceHTML = `
          <span class="search-result-price${offer.hasOffer?' has-offer':''}${soldOut?' is-soldout':''}">
            <span class="search-result-price-num">${priceInner}</span>
            ${soldOut?`<small class="search-result-soldout">Sold out</small>`:''}
          </span>`;
        return `
          <li>
            <button class="search-result${soldOut?' is-soldout':''}" type="button" data-id="${p.id}" data-cat="${p.cat}">
              <span class="search-result-visual">${visual}</span>
              <span class="search-result-body">
                <span class="search-result-brand">${escapeHTML(p.brand||'')}${cat?` · ${escapeHTML(cat.name)}`:''}</span>
                <span class="search-result-name">${highlightMatch(p.name||'', q)}</span>
              </span>
              ${priceHTML}
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function setupSearch(){
  const btn = document.getElementById('searchBtn');
  const closeBtn = document.getElementById('searchClose');
  const backdrop = document.querySelector('#searchOverlay .search-backdrop');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if(!btn || !input || !results) return;

  btn.addEventListener('click', openSearch);
  closeBtn?.addEventListener('click', closeSearch);
  backdrop?.addEventListener('click', closeSearch);

  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && _searchOpened) closeSearch();
  });

  let debounceTimer;
  input.addEventListener('input', e=>{
    clearTimeout(debounceTimer);
    const val = e.target.value;
    debounceTimer = setTimeout(()=>renderSearchResults(val), 70);
  });

  results.addEventListener('click', e=>{
    const r = e.target.closest('.search-result');
    if(!r) return;
    const id = r.dataset.id;
    const cat = r.dataset.cat;
    closeSearch();
    // Αν είμαστε ήδη στη σελίδα products, scroll άμεσα. Αλλιώς navigate πρώτα.
    const onProducts = document.getElementById('page-products')?.classList.contains('active');
    const doScroll = ()=>{
      const card = document.querySelector(`[data-id="${id}"]`);
      const anchor = card || document.getElementById('cat-' + cat);
      if(!anchor) return;
      const offset = 100; // sticky nav clearance
      const y = anchor.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({top:y, behavior:'smooth'});
      if(card){
        card.classList.add('search-highlight');
        setTimeout(()=>card.classList.remove('search-highlight'), 2400);
      }
    };
    if(onProducts){
      setTimeout(doScroll, 60);
    } else {
      navigateTo('products');
      setTimeout(doScroll, 200);
    }
  });

  renderSearchResults('');
}
