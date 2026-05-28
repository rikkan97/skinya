/* ====================================================================
   CATALOG.JS — Σχεδίαση της σελίδας Προϊόντων
   --------------------------------------------------------------------
   Παίρνει τα δεδομένα από data.js και φτιάχνει το HTML που εμφανίζεται.
   Σε κάθε κατηγορία:
     • ένα featured product (μεγάλη κάρτα)
     • ένα grid με τα υπόλοιπα προϊόντα (mini cards)
   Κάθε κάρτα έχει: εικόνα + brand + όνομα + key benefit + tooltip + badges
   ==================================================================== */

// Helper: επιστρέφει το πρώτο γράμμα του brand (fallback αν δεν έχει εικόνα)
function brandInitial(b){
  return (b||'').charAt(0).toUpperCase();
}

// Τύποι badges που εμφανίζονται ως ΣΦΡΑΓΙΔΕΣ (overlay πάνω στην εικόνα),
// όχι ως κανονικά chips στη γραμμή κάτω. Επίσημες πιστοποιήσεις = premium feel.
const SEAL_BADGES = ['leaping-bunny','vegan-society'];

// Render badges (Cruelty Free / Vegan / K-Beauty κτλ.) — bottom row.
// Εξαιρεί τα SEAL_BADGES (αυτά γίνονται render στην εικόνα μέσω renderSeals).
function renderBadges(arr, brand){
  const productBadges = arr || [];
  const brandBadges = (brand && brandCertifications[brand]) || [];
  const all = [...new Set([...brandBadges, ...productBadges])]
    .filter(b => !SEAL_BADGES.includes(b));
  if(!all.length) return '';
  return `<div class="cert-badges">${all.map(b=>{
    const desc = (typeof badgeDescriptions!=='undefined' && badgeDescriptions[b]) || '';
    return `<span class="cert-badge cb-${b}"${desc?` data-tip="${desc.replace(/"/g,'&quot;')}"`:''}>${badgeLabels[b]||b}</span>`;
  }).join('')}</div>`;
}

// Render seals — πιστοποιήσεις σαν σφραγίδες πάνω στην εικόνα προϊόντος
function renderSeals(brand, productBadges){
  const productBadgesArr = productBadges || [];
  const brandBadges = (brand && brandCertifications[brand]) || [];
  const seals = [...new Set([...brandBadges, ...productBadgesArr])]
    .filter(b => SEAL_BADGES.includes(b));
  if(!seals.length) return '';
  return `<div class="product-seals">${seals.map(b=>{
    const desc = (typeof badgeDescriptions!=='undefined' && badgeDescriptions[b]) || '';
    return `<span class="product-seal seal-${b}"${desc?` data-tip="${desc.replace(/"/g,'&quot;')}"`:''}>${badgeLabels[b]||b}</span>`;
  }).join('')}</div>`;
}

// Expandable "Μάθε περισσότερα" — Βοηθάει (bullets) + Tip.
// Στα mini cards δείχνει και σύντομη 2-line περιγραφή πάνω από τα bullets,
// επειδή τα mini δεν εμφανίζουν inline desc. Στα featured η μεγάλη desc
// μένει inline οπότε εδώ μπαίνουν μόνο bullets + tip.
function renderProductMore(p, opts){
  const includeDesc = opts && opts.includeDesc;
  const benefits = Array.isArray(p.benefits) ? p.benefits.filter(Boolean).slice(0,3) : [];
  const hasTip   = !!(p.tip && p.tip.trim());
  const hasShort = includeDesc && !!(p.desc && p.desc.trim());
  if(!benefits.length && !hasTip && !hasShort) return '';
  return `
    <details class="product-more">
      <summary>
        <span class="product-more-label">Μάθε περισσότερα</span>
        <span class="product-more-chev" aria-hidden="true">⌄</span>
      </summary>
      <div class="product-more-body">
        ${hasShort?`<p class="product-more-desc">${p.desc}</p>`:''}
        ${benefits.length?`
          <div class="product-more-benefits">
            <span class="product-more-title">Βοηθάει</span>
            <ul>${benefits.map(b=>`<li>${b}</li>`).join('')}</ul>
          </div>`:''}
        ${hasTip?`<p class="product-more-tip"><span class="product-more-tip-ico">✦</span><span><strong>Tip:</strong> ${p.tip}</span></p>`:''}
      </div>
    </details>
  `;
}

// True όταν stock = 0 (το stock=null/undefined θεωρείται διαθέσιμο για legacy data)
function isSoldOut(p){
  return p && p.stock != null && Number(p.stock) <= 0;
}

// Buy row — όταν sold out, ΜΟΝΟ ένα κεντραρισμένο button (χωρίς τιμή)
function renderBuyRow(p, label){
  if(isSoldOut(p)){
    return `<div class="product-buy is-sold-out-row">
      <button class="btn-add-cart is-soldout" type="button" disabled aria-disabled="true" aria-label="Sold out"><span>Sold out</span></button>
    </div>`;
  }
  return `<div class="product-buy">
    ${renderPriceHTML(p)}
    <button class="btn-add-cart" type="button" onclick="addToCart('${p.id}')" aria-label="Προσθήκη στο καλάθι"><span>${label}</span></button>
  </div>`;
}

// Render της γραμμής με το κύριο benefit + tooltip
function renderKeyIng(p){
  const hasTip = p.tech || p.techDesc;
  return `
    <div class="key-ing${hasTip?' has-tip':''}">
      <span class="key-ing-main">${p.keyIng||''}</span>
      ${hasTip?`<button type="button" class="info-toggle" aria-label="Περισσότερες πληροφορίες">i</button>
      <div class="tooltip" role="tooltip">
        ${p.tech?`<strong>${p.tech}</strong>`:''}
        ${p.techDesc?`<span>${p.techDesc}</span>`:''}
      </div>`:''}
    </div>
  `;
}

// Featured product card (μεγάλη asymmetric κάρτα στην κορυφή κάθε κατηγορίας)
function renderFeatured(p){
  return `
    <article class="featured-product${isSoldOut(p)?' is-sold-out':''}" data-id="${p.id}">
      <span class="featured-tag">★ Best of Category</span>
      <div class="featured-visual${p.img?' has-img':''}">
        ${p.img?`<img src="${p.img}" alt="${p.brand} ${p.name}" loading="lazy">`:`<span class="visual-initial">${brandInitial(p.brand)}</span><span class="visual-mark">Skinya</span>`}
        ${renderSeals(p.brand, p.badges)}
      </div>
      <div class="featured-info">
        <div class="brand-line">${p.brand}${p.size?` · ${p.size}`:''}</div>
        <h3>${p.name}</h3>
        ${renderKeyIng(p)}
        <p class="desc">${p.desc||''}</p>
        ${renderBadges(p.badges, p.brand)}
        ${renderProductMore(p)}
        ${renderBuyRow(p, '+ Στο καλάθι')}
      </div>
    </article>
  `;
}

// Mini card (μικρή κάρτα στο grid)
function renderMiniCard(p){
  return `
    <article class="mini-card${isSoldOut(p)?' is-sold-out':''}" data-id="${p.id}">
      <div class="mini-visual${p.img?' has-img':''}">
        ${p.img?`<img src="${p.img}" alt="${p.brand} ${p.name}" loading="lazy">`:`<span class="visual-initial">${brandInitial(p.brand)}</span>`}
        ${renderSeals(p.brand, p.badges)}
      </div>
      <div class="mini-info">
        <div class="brand-line">${p.brand}${p.size?` · ${p.size}`:''}</div>
        <h4>${p.name}</h4>
        ${renderKeyIng(p)}
        ${renderBadges(p.badges, p.brand)}
        ${renderProductMore(p, { includeDesc: true })}
        ${renderBuyRow(p, '+ Καλάθι')}
      </div>
    </article>
  `;
}

// Render της sticky nav κατηγοριών (επάνω από τα catalog sections)
function renderCategoryNav(){
  const nav = document.getElementById('categoryNav');
  if(!nav) return;
  nav.innerHTML = categories.map((cat,i)=>
    `<a href="#cat-${cat.id}" class="cat-link${i===0?' active':''}">${cat.name}</a>`
  ).join('');
}

// Render όλου του catalog (όλες οι κατηγορίες με τα προϊόντα τους)
function renderCatalog(){
  const container = document.getElementById('catalogContainer');
  if(!container) return;
  container.innerHTML = categories.map(cat=>{
    const items = products.filter(p=>p.cat===cat.id);
    const featured = items.find(p=>p.featured);
    const others = items.filter(p=>!p.featured);
    return `
      <section class="category-section" id="cat-${cat.id}" aria-label="${cat.name}">
        <div class="category-header">
          <span class="cat-step">${cat.step}</span>
          <h2 class="cat-name">${cat.eyebrow}</h2>
          <p class="category-tagline">${cat.desc}</p>
        </div>
        ${featured?renderFeatured(featured):''}
        <div class="cat-grid">${others.map(renderMiniCard).join('')}</div>
      </section>
    `;
  }).join('');
  renderCategoryNav();
  // Re-attach scroll spy στα νέα DOM nodes (κάθε renderCatalog δημιουργεί
  // νέα .category-section elements, οπότε ο παλιός observer είναι stale)
  if(typeof setupScrollSpy === 'function') setupScrollSpy();
}
