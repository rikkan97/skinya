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

let cart = [];

function addToCart(id){
  const product = products.find(p=>p.id===id);
  if(!product) return;
  const existing = cart.find(i=>i.id===id);
  if(existing){
    existing.qty++;
  } else {
    // Resolve price από category default αν δεν υπάρχει per-product
    const price = typeof getProductPrice === 'function' ? getProductPrice(product) : (product.price||0);
    cart.push({...product, price, qty:1});
  }
  updateCart();
  showToast(`${product.brand||''} ${product.name} προστέθηκε ✓`);
  openCart();
  // ΟΧΙ auto-close — ο user κλείνει το cart όποτε θέλει
}

// Προσθέτει πολλά προϊόντα μαζί (bundle) με μία ειδοποίηση,
// αντί για 6+ διαδοχικά toasts από το addToCart.
function addBundle(ids, bundleName){
  ids.forEach(id => {
    const product = products.find(p => p.id === id);
    if(!product) return;
    const existing = cart.find(i => i.id === id);
    if(existing){
      existing.qty++;
    } else {
      const price = typeof getProductPrice === 'function' ? getProductPrice(product) : (product.price||0);
      cart.push({...product, price, qty:1});
    }
  });
  updateCart();
  showToast(`${bundleName} προστέθηκε στο καλάθι ❀`);
  openCart();
}

function changeQty(id, delta){
  const item = cart.find(i=>i.id===id);
  if(item){
    item.qty += delta;
    if(item.qty<=0) cart = cart.filter(i=>i.id!==id);
    updateCart();
  }
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
    items.innerHTML = cart.map(i=>`
      <div class="cart-item">
        <div class="cart-item-img">${i.img?`<img src="${i.img}" alt="${(i.name||'').replace(/"/g,'&quot;')}">`:(i.brand||'').charAt(0)}</div>
        <div class="cart-item-info">
          <h5>${i.brand?i.brand+' · ':''}${i.name}</h5>
          <small>${i.size||''}</small>
          <div class="qty-ctrl">
            <button onclick="changeQty('${i.id}',-1)">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty('${i.id}',1)">+</button>
          </div>
        </div>
        <div style="text-align:right">
          ${i.price?`<div class="cart-item-price">${(i.price*i.qty).toFixed(2)}€</div>`:''}
          <button class="cart-remove" onclick="removeItem('${i.id}')">Αφαίρεση</button>
        </div>
      </div>
    `).join('');
  }
  const total = cart.reduce((s,i)=>s+(i.price||0)*i.qty,0);
  document.getElementById('cartTotal').textContent = total.toFixed(2)+'€';
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

const SHIPPING_FEE = 3.90;

function checkout(){
  if(cart.length === 0){
    showToast('Το καλάθι σας είναι άδειο');
    return;
  }
  // Πρέπει να είναι logged in για να γίνει η παραγγελία (RLS check στο DB)
  if(!window.currentUser){
    showToast('Σύνδεση για να ολοκληρώσεις την παραγγελία');
    closeCart();
    setTimeout(()=>{
      if(typeof openAccount === 'function') openAccount('login');
    }, 300);
    return;
  }

  // Γέμισε τα totals στο checkout view
  const subtotal = cart.reduce((s,i)=>s + (i.price||0)*i.qty, 0);
  const total = subtotal + SHIPPING_FEE;
  document.getElementById('ckSubtotal').textContent = subtotal.toFixed(2) + '€';
  document.getElementById('ckShipping').textContent = SHIPPING_FEE.toFixed(2) + '€';
  document.getElementById('ckTotal').textContent    = total.toFixed(2) + '€';

  cartViewSwitch('checkout');
}

async function submitOrder(e){
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = document.getElementById('ckSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Παρακαλώ περίμενε…';

  try {
    const fd = new FormData(form);
    const shipping_address = {
      first_name: fd.get('first_name')?.trim(),
      last_name:  fd.get('last_name')?.trim(),
      phone:      fd.get('phone')?.trim(),
      line1:      fd.get('line1')?.trim(),
      line2:      fd.get('line2')?.trim() || null,
      city:       fd.get('city')?.trim(),
      postcode:   fd.get('postcode')?.trim(),
      country:    'GR'
    };
    const notes = fd.get('notes')?.trim() || null;

    const subtotal = cart.reduce((s,i)=>s + (i.price||0)*i.qty, 0);
    const total    = subtotal + SHIPPING_FEE;

    const items = cart.map(i => ({
      sku: i.id,
      quantity: i.qty,
      unit_price: i.price || 0,
      snapshot: {
        sku:   i.id,
        name:  i.name,
        brand: i.brand,
        size:  i.size,
        img:   i.img || null
      }
    }));

    const { data, error } = await window.sb.rpc('create_order', {
      p_items: items,
      p_subtotal: Number(subtotal.toFixed(2)),
      p_shipping: SHIPPING_FEE,
      p_total: Number(total.toFixed(2)),
      p_shipping_address: shipping_address,
      p_notes: notes
    });

    if(error) throw error;

    const order = Array.isArray(data) ? data[0] : data;
    const orderNumber = order?.order_number || order?.['order_number'] || '—';

    // Καθάρισε καλάθι + δείξε success
    cart = [];
    updateCart();
    document.getElementById('successOrderNum').textContent = orderNumber;
    cartViewSwitch('success');
    form.reset();

  } catch(err){
    console.error('[Skinya] submitOrder error:', err);
    let msg = 'Σφάλμα κατά την παραγγελία';
    if(err.message?.includes('AUTH_REQUIRED'))     msg = 'Πρέπει να συνδεθείς πρώτα';
    else if(err.message?.includes('CUSTOMER_NOT')) msg = 'Πρόβλημα με τον λογαριασμό σου — δοκίμασε logout/login';
    else if(err.message)                            msg = err.message;
    showToast(msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}
