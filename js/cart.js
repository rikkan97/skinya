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
    items.innerHTML = '<div class="cart-empty">Το καλάθι σας είναι άδειο.<br>Ξεκινήστε το τελετουργικό σας.</div>';
  } else {
    items.innerHTML = cart.map(i=>`
      <div class="cart-item">
        <div class="cart-item-img">${(i.brand||'').charAt(0)}</div>
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
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

function checkout(){
  if(cart.length===0){
    showToast('Το καλάθι σας είναι άδειο');
    return;
  }
  const total = cart.reduce((s,i)=>s+(i.price||0)*i.qty,0);
  // ΜΕΛΛΟΝ: εδώ θα γίνεται fetch('/api/orders', {method:'POST', body:JSON.stringify(cart)})
  showToast(`Παραγγελία ${total.toFixed(2)}€ — ευχαριστούμε ❀`);
  cart = [];
  updateCart();
  closeCart();
}
