/* ====================================================================
   ACCOUNT.JS — Login / Register / Forgot / Profile (Supabase Auth)
   --------------------------------------------------------------------
   • openAccount / closeAccount  — άνοιγμα/κλείσιμο modal
   • accountSwitch(view)         — εναλλαγή ανάμεσα σε views
   • accountSubmit(e, type)      — login/register/forgot via Supabase
   • accountLogout()             — sign out
   • updateAccountUI()           — ενημερώνει το nav button όταν αλλάζει session
   ==================================================================== */

// ──────────────────────────────────────────────────────────────
// Modal open/close + view switching
// ──────────────────────────────────────────────────────────────
function openAccount(view){
  const ov = document.getElementById('accountOverlay');
  if(!ov) return;
  // Αν δεν δόθηκε view, διάλεξε αυτόματα: profile αν logged in, αλλιώς login
  if(!view){
    view = window.currentUser ? 'profile' : 'login';
  }
  accountSwitch(view);
  ov.classList.add('open');
  ov.setAttribute('aria-hidden','false');
  const first = ov.querySelector('.account-view.is-active input');
  if(first) setTimeout(()=>first.focus(), 220);
}

function closeAccount(){
  const ov = document.getElementById('accountOverlay');
  if(!ov) return;
  // Blur any focused element μέσα στο modal πριν το aria-hide (accessibility)
  if(ov.contains(document.activeElement)) document.activeElement.blur();
  ov.classList.remove('open');
  ov.setAttribute('aria-hidden','true');
}

function accountSwitch(view){
  const ov = document.getElementById('accountOverlay');
  if(!ov) return;
  clearAccountMsgs();
  ov.querySelectorAll('.account-view').forEach(v=>{
    v.classList.toggle('is-active', v.dataset.view===view);
  });
  const first = ov.querySelector('.account-view.is-active input');
  if(first) setTimeout(()=>first.focus(), 50);
}

// Inline μήνυμα μέσα στη φόρμα (αντί για toast πίσω από το modal)
function setAccountMsg(form, text, type){
  const el = form?.querySelector('[data-account-msg]');
  if(!el) return;
  if(!text){ el.hidden = true; el.textContent = ''; el.className = 'account-msg'; return; }
  el.textContent = text;
  el.className = 'account-msg ' + (type === 'ok' ? 'is-ok' : 'is-error');
  el.hidden = false;
}
function clearAccountMsgs(){
  document.querySelectorAll('#accountOverlay [data-account-msg]').forEach(el=>{
    el.hidden = true; el.textContent = ''; el.className = 'account-msg';
  });
}

// ──────────────────────────────────────────────────────────────
// Submit handler — login / register / forgot
// ──────────────────────────────────────────────────────────────
async function accountSubmit(e, type){
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn?.querySelector('span')?.textContent;
  // Disable button + δείξε loading
  if(submitBtn){
    submitBtn.disabled = true;
    if(submitBtn.querySelector('span')) submitBtn.querySelector('span').textContent = 'Παρακαλώ περίμενε…';
  }

  const email = form.querySelector('input[name="email"]')?.value?.trim();
  const password = form.querySelector('input[name="password"]')?.value;

  setAccountMsg(form, '');   // καθάρισε προηγούμενο μήνυμα

  try {
    if(type === 'register'){
      const password2 = form.querySelector('input[name="password2"]').value;
      if(password !== password2){
        setAccountMsg(form, 'Οι κωδικοί δεν ταιριάζουν', 'error');
        return;
      }
      const { data, error } = await window.sb.auth.signUp({ email, password });
      if(error) throw error;
      // Welcome email (#11) — best-effort, δεν μπλοκάρει τη ροή
      window.sb.functions.invoke('send-welcome', { body:{ email } })
        .catch(err => console.warn('[Skinya] welcome email failed:', err));
      // Αν το Supabase project έχει "Confirm email" ON, δεν δίνεται session αμέσως
      if(data.session){
        showToast('Καλώς ήρθες ❀');
        form.reset();
        closeAccount();
      } else {
        form.reset();
        accountSwitch('login');
        const loginForm = document.querySelector('.account-view[data-view="login"]');
        setAccountMsg(loginForm, 'Σου στείλαμε email επιβεβαίωσης ✉ — επιβεβαίωσε το και μετά συνδέσου.', 'ok');
      }
    }
    else if(type === 'forgot'){
      const { error } = await window.sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '#reset'
      });
      if(error) throw error;
      setAccountMsg(form, 'Σου στείλαμε σύνδεσμο επαναφοράς στο email σου ✉ (έλεγξε και τα spam).', 'ok');
    }
    else { // login
      const { error } = await window.sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
      showToast('Καλώς ήρθες ❀');
      form.reset();
      closeAccount();
    }
  } catch(err) {
    console.error('[Skinya] Auth error:', err);
    setAccountMsg(form, translateAuthError(err.message), 'error');
  } finally {
    if(submitBtn){
      submitBtn.disabled = false;
      if(submitBtn.querySelector('span') && originalText) submitBtn.querySelector('span').textContent = originalText;
    }
  }
}

// Translate common Supabase auth errors σε Ελληνικά
function translateAuthError(msg){
  if(!msg) return 'Σφάλμα — δοκίμασε ξανά';
  const m = msg.toLowerCase();
  if(m.includes('invalid login credentials')) return 'Λάθος email ή κωδικός';
  if(m.includes('email not confirmed')) return 'Πρέπει να επιβεβαιώσεις το email σου πρώτα';
  if(m.includes('already registered') || m.includes('already exists') || m.includes('user already')) return 'Το email υπάρχει ήδη — δοκίμασε σύνδεση';
  if(m.includes('password') && m.includes('6')) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες';
  if(m.includes('email') && m.includes('valid')) return 'Μη έγκυρο email';
  if(m.includes('rate')) return 'Πολλές προσπάθειες — δοκίμασε σε λίγο';
  if(m.includes('signup') && m.includes('disabled')) return 'Οι εγγραφές είναι προσωρινά κλειστές';
  return 'Σφάλμα: ' + msg;
}

// ──────────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────────
async function accountLogout(){
  const { error } = await window.sb.auth.signOut();
  if(error){
    showToast('Σφάλμα αποσύνδεσης');
    return;
  }
  showToast('Αποσυνδέθηκες ✓');
  closeAccount();
  // Μετά το logout → αρχική (όχι στις παραγγελίες/λογαριασμό)
  if(typeof navigateTo === 'function') navigateTo('home');
}

// ──────────────────────────────────────────────────────────────
// Session detection — ενημερώνει το UI όταν αλλάζει το auth state
// ──────────────────────────────────────────────────────────────
async function updateAccountUI(){
  const { data: { session } } = await window.sb.auth.getSession();
  window.currentUser = session?.user || null;

  // Ενημέρωσε το profile view με το email του χρήστη
  const profileEmail = document.getElementById('profileEmail');
  if(profileEmail) profileEmail.textContent = window.currentUser?.email || '';

  // Ενημέρωσε το nav button — δείξε ένα small dot αν logged in
  const btn = document.getElementById('accountBtn');
  if(btn) btn.classList.toggle('is-logged-in', !!window.currentUser);
}

// ──────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('accountBtn');
  const ov = document.getElementById('accountOverlay');
  const closeBtn = document.getElementById('accountClose');

  if(btn) btn.addEventListener('click', ()=>openAccount());
  if(closeBtn) closeBtn.addEventListener('click', closeAccount);

  if(ov){
    ov.querySelector('.account-backdrop')?.addEventListener('click', closeAccount);
    ov.querySelectorAll('[data-go]').forEach(link=>{
      link.addEventListener('click', e=>{
        e.preventDefault();
        accountSwitch(link.dataset.go);
      });
    });
    // Password show/hide toggles
    ov.querySelectorAll('[data-pw-toggle]').forEach(toggleBtn=>{
      toggleBtn.addEventListener('click', ()=>{
        const input = toggleBtn.parentElement.querySelector('input');
        if(!input) return;
        const shown = input.type === 'text';
        input.type = shown ? 'password' : 'text';
        toggleBtn.classList.toggle('is-shown', !shown);
        toggleBtn.setAttribute('aria-label', shown ? 'Εμφάνιση κωδικού' : 'Απόκρυψη κωδικού');
      });
    });
  }

  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && ov?.classList.contains('open')) closeAccount();
  });

  // Initial session check + listen σε auth state changes
  if(window.sb){
    updateAccountUI();
    window.sb.auth.onAuthStateChange((_event, _session)=>{
      updateAccountUI();
    });
  }
});
