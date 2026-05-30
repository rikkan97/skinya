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
      // Αν το Supabase project έχει "Confirm email" ON, δεν δίνεται session αμέσως.
      // Welcome email φεύγει ΜΕΤΑ την επιβεβαίωση μέσω onAuthStateChange→SIGNED_IN
      // (βλ. maybeSendWelcomeOnce). Αν είναι OFF και έχουμε ήδη session, ο handler
      // θα το πιάσει κανονικά — χωρίς να σταλεί ταυτόχρονα με το confirm email.
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
      // ΣΗΜΑΝΤΙΚΟ: ΟΧΙ '#reset' στο redirectTo — το Supabase appendάρει τα auth
      // tokens στο hash, και ο SDK δεν μπορεί να τα διαβάσει σωστά αν υπάρχει
      // άλλο χωρίς-equals fragment από πριν. Το modal ανοίγει μέσω
      // onAuthStateChange('PASSWORD_RECOVERY'), δεν χρειάζεται hash trigger.
      const { error } = await window.sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if(error) throw error;
      setAccountMsg(form, 'Σου στείλαμε σύνδεσμο επαναφοράς στο email σου ✉ (έλεγξε και τα spam).', 'ok');
    }
    else if(type === 'reset'){
      // Ο user έχει ήδη ενεργή recovery session (από το link του email). Απλά
      // updateUser με νέο password — δεν χρειάζεται email.
      const password2 = form.querySelector('input[name="password2"]').value;
      if(password !== password2){
        setAccountMsg(form, 'Οι κωδικοί δεν ταιριάζουν', 'error');
        return;
      }
      // Pre-check: αν δεν υπάρχει session, ο user δεν ήρθε από έγκυρο email link
      // (π.χ. έβαλε χειροκίνητα #reset). Δείξε σαφές μήνυμα αντί cryptic SDK error.
      const { data: { session } } = await window.sb.auth.getSession();
      if(!session){
        setAccountMsg(form, 'Η συνεδρία επαναφοράς έληξε. Ζήτησε νέο σύνδεσμο.', 'error');
        setTimeout(() => accountSwitch('forgot'), 1800);
        return;
      }
      const { error } = await window.sb.auth.updateUser({ password });
      if(error) throw error;
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(_){}
      form.reset();
      showToast('Ο κωδικός σου άλλαξε ✓');
      closeAccount();
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
  // Μετά το logout → hard redirect στην αρχική. Όχι SPA-swap: θέλουμε
  // καθαρό state (currentUser, cart κλπ) + να φύγουμε σίγουρα από το
  // account page ακόμα κι αν είμαστε σε standalone σελίδα.
  setTimeout(() => { window.location.href = '/'; }, 600);
}

// ──────────────────────────────────────────────────────────────
// Session detection — ενημερώνει το UI όταν αλλάζει το auth state
// ──────────────────────────────────────────────────────────────
async function updateAccountUI(){
  const { data: { session } } = await window.sb.auth.getSession();
  const wasLoggedIn = !!window.currentUser;
  window.currentUser = session?.user || null;

  // Restore cart από Supabase όταν user γίνεται logged-in (login event ή
  // page reload με ενεργό session). Δεν τρέχει σε logout ή σε ήδη
  // logged-in state που δεν άλλαξε.
  if(window.currentUser && !wasLoggedIn && typeof restoreCartFromSupabase === 'function'){
    restoreCartFromSupabase();
  }

  // Ενημέρωσε το nav button — δείξε ένα small dot αν logged in
  const btn = document.getElementById('accountBtn');
  if(btn) btn.classList.toggle('is-logged-in', !!window.currentUser);

  // Greeting: δείξε το όνομα (αν υπάρχει) αλλιώς το email
  let displayName = window.currentUser?.email || '';
  if(window.currentUser){
    try {
      const { data } = await window.sb.from('customers')
        .select('first_name, last_name').eq('id', window.currentUser.id).single();
      const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
      if(full) displayName = full;
    } catch(_){ /* fallback στο email */ }
  }
  const profileEmail = document.getElementById('profileEmail');
  if(profileEmail) profileEmail.textContent = displayName;
  const pageEmail = document.getElementById('accountPageEmail');
  if(pageEmail) pageEmail.textContent = displayName;
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
    window.sb.auth.onAuthStateChange((event, session)=>{
      updateAccountUI();
      // Welcome email φεύγει εδώ (ΜΕΤΑ το email-confirm), όχι κατά το signUp.
      // Atomic claim στο customers.welcome_sent_at → idempotent: τρέχει σε κάθε
      // SIGNED_IN αλλά στέλνει μόνο την πρώτη φορά.
      if(event === 'SIGNED_IN' && session?.user){
        maybeSendWelcomeOnce(session.user);
      }
      // Reset password flow — όταν ο user έρθει από το email link, το Supabase SDK
      // ανταλλάσσει το recovery token με session και πυροδοτεί PASSWORD_RECOVERY.
      // Ανοίγουμε το modal στο reset view ώστε να ορίσει νέο κωδικό.
      if(event === 'PASSWORD_RECOVERY'){
        openAccount('reset');
      }
    });
    // Fallback για παλιότερα Supabase SDK / cold load: αν το URL hash περιέχει
    // type=recovery, άνοιξε το reset view (ο SDK θα έχει ήδη φτιάξει session).
    if(/type=recovery/.test(window.location.hash)){
      openAccount('reset');
    }
  }
});

// Atomic-claim + send welcome email (#11). Καλείται από onAuthStateChange.
// Η UPDATE με `is('welcome_sent_at', null)` παίζει σαν compare-and-swap:
// μόνο ένα tab/session «κερδίζει» το row → μόνο ένα welcome φεύγει.
async function maybeSendWelcomeOnce(user){
  if(!user?.id || !user?.email) return;
  try {
    const { data, error } = await window.sb
      .from('customers')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('welcome_sent_at', null)
      .select('id');
    if(error){ console.warn('[Skinya] welcome claim error:', error); return; }
    if(!data || data.length === 0) return;  // ήδη σταλμένο
    window.sb.functions.invoke('send-welcome', { body:{ email: user.email } })
      .catch(err => console.warn('[Skinya] welcome email failed:', err));
  } catch(err){
    console.warn('[Skinya] maybeSendWelcomeOnce error:', err);
  }
}
