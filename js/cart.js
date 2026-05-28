/* ====================================================================
   CART.JS — Λογική καλαθιού (state + UI update)
   --------------------------------------------------------------------
   • cart[]      — η λίστα προϊόντων που έχει προσθέσει ο χρήστης
   • addToCart   — προσθήκη προϊόντος (από κουμπί "Add")
   • changeQty   — αλλαγή ποσότητας (+/-)
   • removeItem  — αφαίρεση από το καλάθι
   • updateCart  — ξανασχεδιάζει το cart drawer στην οθόνη
   • openCart / closeCart — άνοιγμα / κλείσιμο του συρταριού
   • checkout    — placeholder για ολοκλήρωση παραγγελίας
                   (αργότερα θα στέλνει POST σε backend endpoint)
   ==================================================================== */

// ── Cart persistence ─────────────────────────────────────────
// localStorage για ΟΛΟΥΣ (guest + logged-in). Επιβιώνει refresh,
// tab close, browser restart. Logged-in users έχουν ΕΠΙΠΛΕΟΝ
// Supabase sync (save_abandoned_cart) για cross-device cart.
const CART_STORAGE_KEY = 'skinya_cart';

function loadCartFromStorage(){
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e){ return []; }
}

function saveCartToStorage(){
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch(e){}
}

let cart = loadCartFromStorage();

// Αρχικοποίηση count badge + drawer content (αν υπάρχουν στο DOM).
// Καλείται από app.js μετά το DOMContentLoaded.
function initCartFromStorage(){
  if(document.getElementById('cartCount')) updateCart();
}

// Restore cart από Supabase για logged-in users (cross-device).
// Καλείται από app.js όταν εντοπίσει logged-in user.
async function restoreCartFromSupabase(){
  if(!window.sb || !window.currentUser) return;
  try {
    const { data, error } = await window.sb.rpc('load_abandoned_cart');
    if(error || !data || !Array.isArray(data) || data.length === 0) return;
    // DB items have format {sku, name, brand, price, qty, img} — map back to cart shape
    cart = data.map(i => ({
      id: i.sku, name: i.name, brand: i.brand,
      price: i.price || 0, qty: i.qty || 1, img: i.img || null
    }));
    saveCartToStorage();
    updateCart();
  } catch(e){ /* best-effort */ }
}

// Επιστρέφει true όταν το προϊόν έχει αποθεματικό > 0 (ή stock = null/unset)
function isProductAvailable(p){
  return !p || p.stock == null || Number(p.stock) > 0;
}

// Διαθέσιμο stock τη στιγμή αυτή από το global products array.
// Επιστρέφει null όταν δεν παρακολουθείται stock (δεν επιβάλλεται όριο).
function getProductStock(id){
  const p = products.find(x => x.id === id);
  if(!p || p.stock == null) return null;
  return Number(p.stock);
}

// Toast όταν ο χρήστης προσπαθεί να ξεπεράσει το διαθέσιμο stock.
// Διαφορετικό μήνυμα όταν είναι το «τελευταίο τεμάχιο» για να μην
// απογοητεύσει — του λέμε ότι ΑΥΤΟ που έχει είναι το τελευταίο.
function notifyStockLimit(stock){
  if(stock === 1) showToast('Τελευταίο τεμάχιο — δεν υπάρχει άλλο διαθέσιμο');
  else            showToast(`Διαθέσιμα μόνο ${stock} τεμάχια`);
}

function addToCart(id){
  const product = products.find(p=>p.id===id);
  if(!product) return;
  if(!isProductAvailable(product)){
    showToast('Sold out — δεν είναι διαθέσιμο αυτή τη στιγμή');
    return;
  }
  const existing = cart.find(i=>i.id===id);
  const stock = getProductStock(id);
  const currentQty = existing ? existing.qty : 0;
  if(stock != null && currentQty + 1 > stock){
    notifyStockLimit(stock);
    return;
  }
  if(existing){
    existing.qty++;
  } else {
    // Resolve price από category default αν δεν υπάρχει per-product
    const price = typeof getProductPrice === 'function' ? getProductPrice(product) : (product.price||0);
    cart.push({...product, price, qty:1});
  }
  updateCart();
  showToast(`${product.brand||''} ${product.name} προστέθηκε ✓`);
  bumpCartCount();   // δεν ανοίγει το drawer — απλά «αναπηδά» ο αριθμός
}

// Προσθέτει πολλά προϊόντα μαζί (bundle) με μία ειδοποίηση,
// αντί για 6+ διαδοχικά toasts από το addToCart.
function addBundle(ids, bundleName, discount){
  const pct = (typeof discount === 'number' && discount > 0) ? discount : 0;
  ids.forEach(id => {
    const product = products.find(p => p.id === id);
    if(!product) return;
    if(!isProductAvailable(product)) return;
    const existing = cart.find(i => i.id === id);
    if(existing){
      existing.qty++;
    } else {
      const base  = typeof getProductPrice === 'function' ? getProductPrice(product) : (product.price||0);
      // Εφάρμοσε την έκπτωση του set ώστε το καλάθι να συμφωνεί με το διαφημιζόμενο σύνολο
      const price = pct > 0 ? +(base * (1 - pct)).toFixed(2) : base;
      cart.push({...product, price, qty:1});
    }
  });
  updateCart();
  showToast(`${bundleName} προστέθηκε στο καλάθι ❀`);
  bumpCartCount();
}

// Μικρό «αναπήδημα» στο badge του καλαθιού όταν προστίθεται προϊόν
function bumpCartCount(){
  const el = document.getElementById('cartCount');
  if(!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;          // reflow → restart animation
  el.classList.add('bump');
}

function changeQty(id, delta){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  if(delta > 0){
    const stock = getProductStock(id);
    if(stock != null && item.qty + delta > stock){
      notifyStockLimit(stock);
      return;
    }
  }
  item.qty += delta;
  if(item.qty<=0) cart = cart.filter(i=>i.id!==id);
  updateCart();
}

function removeItem(id){
  cart = cart.filter(i=>i.id!==id);
  updateCart();
}

function updateCart(){
  const items = document.getElementById('cartItems');
  const count = cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cartCount').textContent = count;
  if(cart.length===0){
    items.innerHTML = '<div class="cart-empty">Το καλάθι σας είναι άδειο.</div>';
  } else {
    items.innerHTML = cart.map(i=>{
      const stock = getProductStock(i.id);
      const atMax = stock != null && i.qty >= stock;
      return `
      <div class="cart-item">
        <div class="cart-item-img">${i.img?`<img src="${i.img}" alt="${(i.name||'').replace(/"/g,'&quot;')}">`:(i.brand||'').charAt(0)}</div>
        <div class="cart-item-info">
          <h5>${i.brand?i.brand+' · ':''}${i.name}</h5>
          <small>${i.size||''}${atMax ? ` <span class="qty-max-note">· max</span>` : ''}</small>
          <div class="qty-ctrl">
            <button onclick="changeQty('${i.id}',-1)">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty('${i.id}',1)"${atMax ? ' class="at-max" title="Δεν υπάρχει άλλο stock"' : ''}>+</button>
          </div>
        </div>
        <div style="text-align:right">
          ${i.price?`<div class="cart-item-price">${(i.price*i.qty).toFixed(2)}€</div>`:''}
          <button class="cart-remove" onclick="removeItem('${i.id}')">Αφαίρεση</button>
        </div>
      </div>
    `;
    }).join('');
  }
  const total = cart.reduce((s,i)=>s+(i.price||0)*i.qty,0);
  document.getElementById('cartTotal').textContent = total.toFixed(2)+'€';

  saveCartToStorage();      // localStorage (guest + logged-in)
  scheduleAbandonedSave();  // Supabase sync (logged-in μόνο)
}

// ── Abandoned cart capture (#12) — μόνο για συνδεδεμένους, throttled ──
let _abandonedTimer = null;
function scheduleAbandonedSave(){
  if(!window.currentUser) return;            // capture μόνο logged-in
  clearTimeout(_abandonedTimer);
  _abandonedTimer = setTimeout(()=>{
    if(cart.length === 0) return;
    const items = cart.map(i=>({ sku:i.id, name:i.name, brand:i.brand, price:i.price||0, qty:i.qty, img:i.img||null }));
    const subtotal = cart.reduce((s,i)=>s+(i.price||0)*i.qty, 0);
    // Supabase v2 builder είναι PromiseLike: .then() αντί για .catch()
    try {
      window.sb.rpc('save_abandoned_cart', { p_items: items, p_subtotal: Number(subtotal.toFixed(2)) })
        .then(()=>{}, ()=>{});            // best-effort, swallow errors
    } catch(_){ /* sync throw — ignore */ }
  }, 2500);
}

function openCart(){
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
}

function closeCart(){
  const drawer = document.getElementById('cartDrawer');
  if(drawer && drawer.contains(document.activeElement)) document.activeElement.blur();
  drawer.classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  // Reset σε cart view για επόμενο άνοιγμα
  setTimeout(()=>cartViewSwitch('cart'), 350);
}

// Εναλλαγή ανάμεσα σε cart / checkout / success views
function cartViewSwitch(view){
  const drawer = document.getElementById('cartDrawer');
  if(!drawer) return;
  drawer.querySelectorAll('.cart-view').forEach(v=>{
    v.classList.toggle('is-active', v.dataset.cartView === view);
  });
  // Title ανά view
  const title = document.getElementById('cartTitle');
  if(title){
    if(view === 'checkout')      title.innerHTML = '<em>Στοιχεία</em> αποστολής';
    else if(view === 'success')  title.innerHTML = '<em>Παραγγελία</em> ολοκληρώθηκε';
    else                          title.innerHTML = '<em>Skinya</em> Box';
  }
}

const SHIPPING_FEE = 4.00;

// «Ολοκλήρωση Αγοράς» → κλείνει το drawer και πάει στην πλήρη σελίδα checkout.
function checkout(){
  if(cart.length === 0){
    showToast('Το καλάθι σας είναι άδειο');
    return;
  }
  closeCart();
  if(typeof navigateTo === 'function') navigateTo('checkout');
  renderCheckout();
}

let appliedCoupon = null;   // { code, kind:'percentage'|'fixed', value:number }
let _bankSettings = null;   // cache στοιχείων τραπεζικού λογ/σμού

// Γεμίζει τη σελίδα checkout (σύνοψη, totals, prefill email).
function renderCheckout(){
  const itemsEl = document.getElementById('checkoutItems');
  if(itemsEl){
    itemsEl.innerHTML = cart.length ? cart.map(i=>`
      <div class="checkout-line">
        <div class="checkout-line-img">${i.img?`<img src="${i.img}" alt="">`:(i.brand||'').charAt(0)}</div>
        <div class="checkout-line-info">
          <h5>${i.brand?i.brand+' · ':''}${i.name}</h5>
          <small>${i.qty} × ${(i.price||0).toFixed(2)}€</small>
        </div>
        <div class="checkout-line-price">${((i.price||0)*i.qty).toFixed(2)}€</div>
      </div>`).join('') : '<div class="cart-empty">Το καλάθι σου είναι άδειο.</div>';
  }

  recalcCheckoutTotals();

  const emailInput = document.querySelector('#checkoutForm input[name="email"]');
  if(emailInput){
    if(window.currentUser?.email){
      emailInput.value = window.currentUser.email;
      emailInput.readOnly = true;
    } else {
      emailInput.readOnly = false;
    }
  }

  loadBankDetails();
  onPaymentMethodChange();
  onShippingMethodChange();
}

// Υπολογίζει subtotal / έκπτωση / σύνολο και ενημερώνει το UI.
function recalcCheckoutTotals(){
  const subtotal = cart.reduce((s,i)=>s + (i.price||0)*i.qty, 0);

  let discount = 0;
  if(appliedCoupon){
    discount = appliedCoupon.kind === 'percentage'
      ? subtotal * (appliedCoupon.value/100)
      : appliedCoupon.value;
    discount = Math.round(Math.min(discount, subtotal) * 100) / 100;
  }

  const total = Math.max(0, subtotal + SHIPPING_FEE - discount);
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
  set('pgSubtotal', subtotal.toFixed(2) + '€');
  set('pgShipping', SHIPPING_FEE.toFixed(2) + '€');
  set('pgTotal',    total.toFixed(2) + '€');

  const row = document.getElementById('pgDiscountRow');
  if(row){
    row.hidden = !(appliedCoupon && discount > 0);
    set('pgDiscount', '-' + discount.toFixed(2) + '€');
    // Δείξε και το ποσοστό για coupon ποσοστού (π.χ. «SKINYA12 −12%»)
    let label = '';
    if(appliedCoupon){
      label = appliedCoupon.code;
      if(appliedCoupon.kind === 'percentage') label += ` −${appliedCoupon.value}%`;
    }
    set('pgCouponLabel', label);
  }
  return { subtotal, discount, total };
}

// Εφαρμογή / αφαίρεση κουπονιού (validation client-side· τελικός έλεγχος γίνεται server-side).
async function applyCoupon(){
  const input = document.getElementById('couponInput');
  const msg   = document.getElementById('couponMsg');
  const btn   = document.getElementById('couponBtn');
  const showMsg = (text, ok)=>{
    if(!msg) return;
    msg.hidden = false; msg.textContent = text;
    msg.classList.toggle('is-ok', !!ok);
    msg.classList.toggle('is-err', !ok);
  };

  // Ήδη εφαρμοσμένο → αφαίρεση
  if(appliedCoupon){
    appliedCoupon = null;
    if(input){ input.value = ''; input.readOnly = false; }
    if(btn) btn.textContent = 'Εφαρμογή';
    if(msg) msg.hidden = true;
    recalcCheckoutTotals();
    return;
  }

  const code = (input?.value || '').trim().toUpperCase();
  if(!code){ showMsg('Γράψε έναν κωδικό κουπονιού.', false); return; }

  if(btn) btn.disabled = true;
  try {
    const { data, error } = await window.sb
      .from('coupons')
      .select('code, discount_kind, discount_value, min_order_amount, max_uses, uses_count, valid_from, valid_until, is_active')
      .ilike('code', code)
      .maybeSingle();
    if(error) throw error;

    const subtotal = cart.reduce((s,i)=>s + (i.price||0)*i.qty, 0);
    const now = new Date();
    if(!data || !data.is_active)                                     return showMsg('Μη έγκυρος κωδικός.', false);
    if(data.valid_from  && new Date(data.valid_from)  > now)         return showMsg('Το κουπόνι δεν ισχύει ακόμη.', false);
    if(data.valid_until && new Date(data.valid_until) < now)         return showMsg('Το κουπόνι έχει λήξει.', false);
    if(data.max_uses != null && data.uses_count >= data.max_uses)    return showMsg('Το κουπόνι εξαντλήθηκε.', false);
    if(data.min_order_amount != null && subtotal < data.min_order_amount)
      return showMsg(`Ισχύει για παραγγελίες ≥ ${Number(data.min_order_amount).toFixed(2)}€.`, false);

    appliedCoupon = { code: data.code, kind: data.discount_kind, value: Number(data.discount_value) };
    const { discount } = recalcCheckoutTotals();
    if(input) input.readOnly = true;
    if(btn) btn.textContent = 'Αφαίρεση';
    const pct = data.discount_kind === 'percentage' ? ` (−${Number(data.discount_value)}%)` : '';
    showMsg(`Εφαρμόστηκε «${data.code}»${pct} — έκπτωση ${discount.toFixed(2)}€ ✓`, true);
  } catch(err){
    console.error('[Skinya] applyCoupon error:', err);
    showMsg('Σφάλμα ελέγχου κουπονιού.', false);
  } finally {
    if(btn) btn.disabled = false;
  }
}

// Φέρνει τα στοιχεία τραπεζικής κατάθεσης (store_settings) και τα γεμίζει στις bank-box.
async function loadBankDetails(){
  if(!_bankSettings){
    try {
      const { data } = await window.sb
        .from('store_settings')
        .select('bank_name, bank_holder, bank_iban, bank_swift')
        .eq('id', 1)
        .maybeSingle();
      _bankSettings = data || {};
    } catch(e){ _bankSettings = {}; }
  }
  fillBankDetails(_bankSettings);
}

function fillBankDetails(s){
  const setAll = (cls,val)=>document.querySelectorAll('.'+cls).forEach(el=>{ el.textContent = val; });
  setAll('bank-val-name',   s.bank_name   || '—');
  setAll('bank-val-holder', s.bank_holder || 'Skinya');
  setAll('bank-val-iban',   s.bank_iban   || '—');
  const swift = (s.bank_swift || '').trim();
  document.querySelectorAll('.bank-row-swift').forEach(el=>{ el.hidden = !swift; });
  if(swift) setAll('bank-val-swift', swift);
}

// Toggle τραπεζικών στοιχείων + label κουμπιού ανά τρόπο πληρωμής.
function onPaymentMethodChange(){
  // Μόνο τραπεζική κατάθεση πια — κρατάμε τη συνάρτηση για backward compat.
  const bank = document.getElementById('bankDetails');
  if(bank) bank.hidden = false;
  const btn = document.getElementById('pgSubmitBtn');
  if(btn) btn.textContent = 'Καταχώρηση παραγγελίας';
}

// Toggle Box Now locker field + απαίτηση συμπλήρωσης ανά τρόπο αποστολής.
function onShippingMethodChange(){
  const method = document.querySelector('#checkoutForm input[name="shipping_method"]:checked')?.value || 'box_now';
  const wrap   = document.getElementById('boxNowLockerWrap');
  const showLocker = (method === 'box_now');
  if(wrap) wrap.hidden = !showLocker;
  if(showLocker) loadBoxNowWidget();
}

// Reset της επιλογής Box Now — επαναφέρει το picker button και κάνει
// programmatic click ώστε να ανοίξει ξανά το widget (το <a> picker είναι
// αυτό που έχει wire-up από το script · η "Αλλαγή" απλά delegates).
function resetBoxNowSelection(){
  const hidden  = document.getElementById('boxNowLockerInput');
  const display = document.getElementById('boxNowSelectedDisplay');
  const pickBtn = document.getElementById('boxNowPickerBtn');
  if(hidden)  hidden.value = '';
  if(display) display.hidden = true;
  if(pickBtn){
    pickBtn.hidden = false;
    // setTimeout ώστε να ολοκληρωθεί το show πριν το click trigger
    setTimeout(()=> pickBtn.click(), 30);
  }
}

// ──────────────────────────────────────────────────────────────
// Box Now official map widget loader
// ──────────────────────────────────────────────────────────────
// Φορτώνει το επίσημο script + config μόνο μία φορά. Όταν επιλέγεται
// locker, ο afterSelect callback γεμίζει το UI και το hidden input.
let _boxnowLoaded = false;
function loadBoxNowWidget(){
  if(_boxnowLoaded) return;
  _boxnowLoaded = true;

  // Config — πρέπει να οριστεί ΠΡΙΝ φορτωθεί το script
  window._bn_map_widget_config = {
    parentElement: '#boxnowmap',
    type: 'popup',
    autoclose: true,
    buttonSelector: '.boxnow-map-widget-button',
    afterSelect: function(locker){
      if(!locker) return;
      const data = {
        id:       locker.boxnowLockerId            || '',
        name:     locker.boxnowLockerName          || '',
        address:  locker.boxnowLockerAddressLine1  || '',
        postcode: locker.boxnowLockerPostalCode    || ''
      };
      const hidden  = document.getElementById('boxNowLockerInput');
      const title   = document.getElementById('boxNowSelectedTitle');
      const addr    = document.getElementById('boxNowSelectedAddress');
      const display = document.getElementById('boxNowSelectedDisplay');
      const pickBtn = document.getElementById('boxNowPickerBtn');
      if(hidden)  hidden.value = JSON.stringify(data);
      if(title)   title.textContent = data.name || (data.id ? `BOX ${data.id}` : 'Επιλεγμένο σημείο');
      if(addr)    addr.textContent  = [data.address, data.postcode].filter(Boolean).join(' · ') || '—';
      if(display) display.hidden = false;
      if(pickBtn) pickBtn.hidden = true;
    }
  };

  const s = document.createElement('script');
  s.src = 'https://widget-cdn.boxnow.gr/map-widget/client/v5.js';
  s.async = true;
  document.head.appendChild(s);

  // Δεν ξέρουμε τι class/id έχει το widget popup του Box Now — οπότε όταν
  // ο χρήστης πατά τον picker, βάζουμε class `bn-picking` στο body που
  // (μέσω CSS) κρύβει visibility όλα τα checkout cards/summary. Έτσι ΤΙΠΟΤΑ
  // δεν τρυπάει μπροστά από το popup. Όταν το widget DOM αφαιρεθεί
  // (selection ή close), το MutationObserver το ανιχνεύει και unhide.
  let _savedOverflow = null;
  function startBoxNowMode(){
    document.body.classList.add('bn-picking');
    if(_savedOverflow === null){
      _savedOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
    }
  }
  function endBoxNowMode(){
    document.body.classList.remove('bn-picking');
    if(_savedOverflow !== null){
      document.body.style.overflow = _savedOverflow;
      _savedOverflow = null;
    }
  }

  // Όταν ο user πατά τον picker → ενεργοποίηση mode
  const pickBtn = document.getElementById('boxNowPickerBtn');
  if(pickBtn) pickBtn.addEventListener('click', startBoxNowMode);

  // Watch ολόκληρο το body για ανίχνευση του popup wrapper + αφαίρεσης
  let _bnPopupRoot = null;
  const looksLikeBoxNow = (node) => {
    if(!node || node.nodeType !== 1) return false;
    const id  = node.id || '';
    const cls = (typeof node.className === 'string') ? node.className : '';
    if(/boxnow|bn-(widget|popup)/i.test(id+' '+cls)) return true;
    // ή iframe με boxnow src
    if(node.tagName === 'IFRAME' && /boxnow/i.test(node.src||'')) return true;
    // ή περιέχει τέτοιο iframe
    if(node.querySelector && node.querySelector('iframe[src*="boxnow"]')) return true;
    return false;
  };
  const bodyObserver = new MutationObserver(mutations => {
    for(const m of mutations){
      for(const n of m.addedNodes){
        if(!_bnPopupRoot && looksLikeBoxNow(n)){
          _bnPopupRoot = n;
          startBoxNowMode();
        }
      }
      for(const n of m.removedNodes){
        if(n === _bnPopupRoot){
          _bnPopupRoot = null;
          endBoxNowMode();
        }
      }
    }
  });
  bodyObserver.observe(document.body, { childList:true, subtree:true });

  // ESC fallback — αν το widget φύγει χωρίς να ενημερώσει observer
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && document.body.classList.contains('bn-picking')){
      setTimeout(()=> { if(!document.querySelector('iframe[src*="boxnow"]')) endBoxNowMode(); }, 200);
    }
  });
}

// Πάει σε ΞΕΧΩΡΙΣΤΗ σελίδα επιβεβαίωσης (#page-order-confirmed) και τη γεμίζει.
function finishOrderSuccess(orderNumber, total, mode){
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
  set('pgSuccessOrderNum', orderNumber);
  const bankBlock = document.getElementById('pgSuccessBank');
  if(bankBlock){
    const showBank = (mode === 'bank_transfer');
    bankBlock.hidden = !showBank;
    if(showBank) set('pgSuccessAmount', (total||0).toFixed(2) + '€');
  }
  loadBankDetails();   // σιγουρεύει ότι το IBAN box είναι γεμάτο και στη σελίδα επιβεβαίωσης
  if(typeof navigateTo === 'function') navigateTo('order-confirmed');
  else window.scrollTo({ top:0, behavior:'smooth' });
}

// Βρες το πρώτο [required] πεδίο που είναι κενό/μη έγκυρο, scroll smooth
// με offset για το sticky header, focus + toast με το όνομα του πεδίου.
// Επιστρέφει true αν όλα ok, false αν βρέθηκε κενό (το submit μπλοκάρει).
function validateRequiredFields(form){
  const fields = form.querySelectorAll('[required]');
  for(const el of fields){
    // Skip hidden / disabled
    if(el.disabled || el.type === 'hidden') continue;
    if(el.offsetParent === null) continue;  // δεν φαίνεται (π.χ. inside hidden section)
    const ok = el.checkValidity?.() ?? !!(el.value && el.value.trim());
    if(ok) continue;

    // Friendly label από το wrapping <label> ή placeholder
    const wrapLabel = el.closest('label')?.querySelector('span')?.textContent
                    || el.previousElementSibling?.textContent
                    || el.placeholder
                    || 'αυτό το πεδίο';
    const cleanLabel = wrapLabel.replace(/\s*\([^)]*\)\s*$/, '').trim();

    // Scroll στο ΟΛΟ το section που περιέχει το πεδίο, όχι μόνο στο input
    const section = el.closest('.checkout-card') || el;
    const y = section.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top:y, behavior:'smooth' });
    setTimeout(()=> el.focus({ preventScroll:true }), 380);

    // Visual hint — orange border flash
    el.classList.add('field-error');
    setTimeout(()=> el.classList.remove('field-error'), 2400);

    showToast(`Παρακαλώ συμπλήρωσε: ${cleanLabel}`, 'warn');
    return false;
  }
  return true;
}

async function submitOrder(e){
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = document.getElementById('pgSubmitBtn');
  const originalText = submitBtn?.textContent || 'Ολοκλήρωση';

  // Custom validation πρώτα — αν έχει κενό, σταμάτα ΠΡΙΝ disable το button.
  if(!validateRequiredFields(form)) return;

  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Παρακαλώ περίμενε…'; }

  try {
    if(cart.length === 0){
      showToast('Το καλάθι σου είναι άδειο');
      return;
    }

    const fd = new FormData(form);

    // Τρόπος αποστολής + Box Now locker
    const shippingMethod = fd.get('shipping_method') || 'box_now';
    const boxnowLocker = (fd.get('boxnow_locker') || '').toString().trim();
    if(shippingMethod === 'box_now' && !boxnowLocker){
      const section = document.getElementById('boxNowLockerWrap')?.closest('.checkout-card');
      if(section){
        const y = section.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top:y, behavior:'smooth' });
      }
      showToast('Παρακαλώ επίλεξε σημείο παραλαβής Box Now', 'warn');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalText; }
      return;
    }

    const shipping_address = {
      first_name: fd.get('first_name')?.trim(),
      last_name:  fd.get('last_name')?.trim(),
      phone:      fd.get('phone')?.trim(),
      line1:      fd.get('line1')?.trim(),
      line2:      fd.get('line2')?.trim() || null,
      city:       fd.get('city')?.trim(),
      region:     fd.get('region')?.trim() || null,
      postcode:   fd.get('postcode')?.trim(),
      country:    'GR',
      shipping_method: shippingMethod,                                // 'box_now' | 'elta_courier'
      boxnow_locker:   shippingMethod === 'box_now' ? boxnowLocker : null
    };
    const notes         = fd.get('notes')?.trim() || null;
    const guestEmail    = fd.get('email')?.trim() || null;
    const paymentMethod = fd.get('payment_method') || 'card';
    const termsAccepted = !!form.querySelector('input[name="terms"]')?.checked;

    if(!termsAccepted){
      showToast('Πρέπει να αποδεχτείς τους Όρους & Προϋποθέσεις');
      return;
    }

    const { subtotal, total } = recalcCheckoutTotals();

    const items = cart.map(i => ({
      sku: i.id,
      quantity: i.qty,
      unit_price: i.price || 0,
      snapshot: { sku:i.id, name:i.name, brand:i.brand, size:i.size, img:i.img || null }
    }));

    const { data, error } = await window.sb.rpc('create_order', {
      p_items: items,
      p_subtotal: Number(subtotal.toFixed(2)),
      p_shipping: SHIPPING_FEE,
      p_total: Number(total.toFixed(2)),
      p_shipping_address: shipping_address,
      p_notes: notes,
      p_guest_email: guestEmail,
      p_terms_accepted: termsAccepted,
      p_payment_method: paymentMethod,
      p_coupon_code: appliedCoupon ? appliedCoupon.code : null
    });

    if(error) throw error;

    const finalTotal = total;

    const order       = Array.isArray(data) ? data[0] : data;
    const orderNumber = order?.order_number || '—';
    const orderId     = order?.order_id || null;

    // Email επιβεβαίωσης «Λάβαμε την παραγγελία σας» — fire-and-forget.
    if(orderId){
      window.sb.functions.invoke('send-order-email', {
        body: { type: 'received', order_id: orderId }
      }).catch(err => console.warn('[Skinya] confirmation email failed:', err));
    }

    // Η παραγγελία δημιουργήθηκε — mark recovered το abandoned cart (best-effort).
    if(window.currentUser){
      window.sb.rpc('clear_abandoned_cart').catch(()=>{});
    }

    // άδειασε το καλάθι + reset κουπονιού.
    cart = [];
    appliedCoupon = null;
    updateCart();

    // ── ΚΑΡΤΑ (Viva Wallet): redirect στο Smart Checkout ──────────────
    if(paymentMethod === 'card'){
      if(submitBtn) submitBtn.textContent = 'Μεταφορά στην πληρωμή…';
      try {
        const { data: pay, error: payErr } = await window.sb.functions.invoke('create-viva-payment', {
          body: { order_id: orderId }
        });
        if(payErr) throw payErr;
        if(pay?.checkout_url){
          window.location.href = pay.checkout_url;  // φεύγουμε προς Viva
          return;
        }
        throw new Error('NO_CHECKOUT_URL');
      } catch(payErr){
        // Η online πληρωμή δεν είναι (ακόμα) ενεργή — η παραγγελία υπάρχει ως pending.
        console.warn('[Skinya] Viva payment init failed:', payErr);
        showToast('Η online πληρωμή με κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή — η παραγγελία καταχωρήθηκε');
        finishOrderSuccess(orderNumber, finalTotal, 'pending_card');
        return;
      }
    }

    // ── ΤΡΑΠΕΖΙΚΗ ΚΑΤΑΘΕΣΗ: success με IBAN ───────────────────────────
    finishOrderSuccess(orderNumber, finalTotal, 'bank_transfer');

  } catch(err){
    console.error('[Skinya] submitOrder error:', err);
    let msg = 'Σφάλμα κατά την παραγγελία';
    if(err.message?.includes('TERMS_NOT_ACCEPTED'))   msg = 'Πρέπει να αποδεχτείς τους Όρους & Προϋποθέσεις';
    else if(err.message?.includes('GUEST_EMAIL'))     msg = 'Συμπλήρωσε το email σου για την επιβεβαίωση';
    else if(err.message?.includes('INVALID_PAYMENT')) msg = 'Μη έγκυρος τρόπος πληρωμής';
    else if(err.message?.includes('COUPON_INVALID'))  msg = 'Μη έγκυρο κουπόνι — αφαίρεσέ το και δοκίμασε ξανά';
    else if(err.message?.includes('COUPON_MIN_ORDER'))msg = 'Το κουπόνι δεν ισχύει για αυτό το ποσό παραγγελίας';
    else if(err.message?.includes('COUPON_EXHAUSTED'))msg = 'Το κουπόνι εξαντλήθηκε';
    else if(err.message?.includes('CUSTOMER_NOT'))    msg = 'Πρόβλημα με τον λογαριασμό σου — δοκίμασε logout/login';
    else if(err.message)                               msg = err.message;
    showToast(msg);
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalText; }
  }
}
