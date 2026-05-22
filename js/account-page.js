/* ====================================================================
   ACCOUNT-PAGE.JS — Σελίδα "Ο λογαριασμός μου"
   --------------------------------------------------------------------
   • loadAccountPage()  — καλείται όταν ο user πλοηγείται στο /account
   • loadOrders()       — φέρνει τις παραγγελίες του χρήστη από DB
   • loadProfile()      — γεμίζει τη φόρμα με τα στοιχεία του χρήστη
   • saveProfile()      — αποθηκεύει αλλαγές στο customers table
   • Tab switching: orders ↔ profile
   ==================================================================== */

const ORDER_STATUS_LABELS = {
  pending:    {label:'Σε αναμονή πληρωμής', cls:'st-pending'},
  paid:       {label:'Πληρωμένη',           cls:'st-paid'},
  processing: {label:'Σε επεξεργασία',      cls:'st-processing'},
  shipped:    {label:'Αποστάλθηκε',         cls:'st-shipped'},
  delivered:  {label:'Παραδόθηκε',          cls:'st-delivered'},
  cancelled:  {label:'Ακυρώθηκε',           cls:'st-cancelled'},
  refunded:   {label:'Επιστράφηκε',         cls:'st-refunded'},
};

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('el-GR', {day:'2-digit', month:'short', year:'numeric'});
}
function fmtMoney(n){
  return (Number(n)||0).toFixed(2) + '€';
}
function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ──────────────────────────────────────────────────────────────
// Καλείται όταν ο user πλοηγείται στο page-account
// ──────────────────────────────────────────────────────────────
async function loadAccountPage(){
  // Αν δεν είναι logged in, redirect στο home + open login
  if(!window.currentUser){
    navigateTo('home');
    setTimeout(()=>{ if(typeof openAccount === 'function') openAccount('login'); }, 200);
    return;
  }
  // Δείξε το email στο header
  const emailEl = document.getElementById('accountPageEmail');
  if(emailEl) emailEl.textContent = window.currentUser.email || '';

  // Default tab = orders
  acctTabSwitch('orders');
  loadOrders();
  loadProfile();
}

// ──────────────────────────────────────────────────────────────
// Tab switching
// ──────────────────────────────────────────────────────────────
function acctTabSwitch(tab){
  document.querySelectorAll('.acct-tab[data-acct-tab]').forEach(b=>{
    b.classList.toggle('is-active', b.dataset.acctTab === tab);
  });
  document.querySelectorAll('.acct-pane').forEach(p=>{
    p.classList.toggle('is-active', p.dataset.acctPane === tab);
  });
}

// ──────────────────────────────────────────────────────────────
// Load orders (own only, via RLS)
// ──────────────────────────────────────────────────────────────
async function loadOrders(){
  const container = document.getElementById('ordersList');
  if(!container) return;
  container.innerHTML = '<p class="acct-empty">Φόρτωση παραγγελιών…</p>';

  try {
    const { data, error } = await window.sb
      .from('orders')
      .select('id, order_number, status, subtotal, shipping, total, currency, shipping_address, notes, created_at, items:order_items(quantity, unit_price, line_total, product_snapshot)')
      .order('created_at', { ascending: false });

    if(error) throw error;

    if(!data || data.length === 0){
      container.innerHTML = `
        <div class="acct-empty-state">
          <p class="acct-empty">Δεν έχεις ακόμα παραγγελίες.</p>
          <a class="btn-primary" data-route="products"><span>Ανακάλυψε προϊόντα</span></a>
        </div>`;
      return;
    }

    container.innerHTML = data.map(renderOrderCard).join('');
  } catch(err){
    console.error('[Skinya] loadOrders error:', err);
    container.innerHTML = `<p class="acct-empty">Σφάλμα φόρτωσης παραγγελιών — δοκίμασε refresh.</p>`;
  }
}

function renderOrderCard(o){
  const st = ORDER_STATUS_LABELS[o.status] || {label:o.status, cls:''};
  const itemsCount = (o.items||[]).reduce((s,i)=>s+i.quantity, 0);
  const itemsHtml = (o.items||[]).map(it => {
    const snap = it.product_snapshot || {};
    return `
      <li class="ord-item">
        <div class="ord-item-thumb">${snap.img ? `<img src="${escapeHTML(snap.img)}" alt="">` : (snap.brand||'').charAt(0)}</div>
        <div class="ord-item-info">
          <small>${escapeHTML(snap.brand||'')}</small>
          <strong>${escapeHTML(snap.name||'')}</strong>
          <span>${it.quantity} × ${fmtMoney(it.unit_price)}</span>
        </div>
        <div class="ord-item-total">${fmtMoney(it.line_total)}</div>
      </li>`;
  }).join('');

  const addr = o.shipping_address || {};
  const addrLine = [addr.line1, addr.line2, addr.postcode, addr.city].filter(Boolean).join(' · ');

  return `
    <article class="ord-card" data-order-id="${o.id}">
      <div class="ord-head">
        <div>
          <div class="ord-num">${escapeHTML(o.order_number)}</div>
          <div class="ord-date">${fmtDate(o.created_at)} · ${itemsCount} ${itemsCount===1?'προϊόν':'προϊόντα'}</div>
        </div>
        <div class="ord-status ${st.cls}">${st.label}</div>
      </div>

      <ul class="ord-items">${itemsHtml}</ul>

      <div class="ord-foot">
        <div class="ord-addr"><small>Αποστολή</small>${escapeHTML(addrLine)||'—'}</div>
        <div class="ord-totals">
          <div><span>Υποσύνολο</span><span>${fmtMoney(o.subtotal)}</span></div>
          <div><span>Μεταφορικά</span><span>${fmtMoney(o.shipping)}</span></div>
          <div class="ord-total-grand"><span>Σύνολο</span><span>${fmtMoney(o.total)}</span></div>
        </div>
      </div>
    </article>`;
}

// ──────────────────────────────────────────────────────────────
// Profile load/save
// ──────────────────────────────────────────────────────────────
async function loadProfile(){
  const form = document.getElementById('profileForm');
  if(!form || !window.currentUser) return;

  try {
    const { data, error } = await window.sb
      .from('customers')
      .select('email, first_name, last_name, phone, newsletter')
      .eq('id', window.currentUser.id)
      .single();

    if(error) throw error;

    form.querySelector('input[name="email"]').value      = data?.email      || window.currentUser.email || '';
    form.querySelector('input[name="first_name"]').value = data?.first_name || '';
    form.querySelector('input[name="last_name"]').value  = data?.last_name  || '';
    form.querySelector('input[name="phone"]').value      = data?.phone      || '';
    form.querySelector('input[name="newsletter"]').checked = !!data?.newsletter;

    // Greeting: όνομα αν υπάρχει, αλλιώς email
    const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
    const greet = document.getElementById('accountPageEmail');
    if(greet) greet.textContent = full || data?.email || window.currentUser.email || '';
  } catch(err){
    console.error('[Skinya] loadProfile error:', err);
  }
}

async function saveProfile(e){
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('button[type="submit"]');
  const orig = btn.querySelector('span')?.textContent;
  btn.disabled = true;
  if(btn.querySelector('span')) btn.querySelector('span').textContent = 'Αποθήκευση…';

  try {
    const fd = new FormData(form);
    const { error } = await window.sb
      .from('customers')
      .update({
        first_name: fd.get('first_name')?.trim() || null,
        last_name:  fd.get('last_name')?.trim()  || null,
        phone:      fd.get('phone')?.trim()      || null,
        newsletter: !!fd.get('newsletter')
      })
      .eq('id', window.currentUser.id);

    if(error) throw error;
    showToast('Τα στοιχεία αποθηκεύτηκαν ✓');
    if(typeof updateAccountUI === 'function') updateAccountUI();   // refresh greeting με το νέο όνομα
  } catch(err){
    console.error('[Skinya] saveProfile error:', err);
    showToast('Σφάλμα αποθήκευσης');
  } finally {
    btn.disabled = false;
    if(btn.querySelector('span') && orig) btn.querySelector('span').textContent = orig;
  }
}

// ──────────────────────────────────────────────────────────────
// Wire up tabs
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.acct-tab[data-acct-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>acctTabSwitch(btn.dataset.acctTab));
  });
});
