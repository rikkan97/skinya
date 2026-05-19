/* ====================================================================
   SUPABASE-CLIENT.JS — Initializes the global Supabase client
   --------------------------------------------------------------------
   • Φορτώνεται ΠΡΙΝ τα υπόλοιπα scripts του site (data, api, app, ...)
   • Εκθέτει global window.sb (= Supabase client instance)
   • URL & publishable key είναι safe για frontend — αποκλειστική ασφάλεια
     παρέχεται από Row Level Security (RLS) policies στη DB.
   ==================================================================== */

const SUPABASE_URL  = 'https://swkdewwmmxsftdmzjqsr.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_ORVm0gPr-42u4Eif_PRTNQ_Ko1SFnzI';

// Χρειάζεται να έχει φορτωθεί το @supabase/supabase-js global (UMD bundle)
if (typeof supabase === 'undefined') {
  console.error('[Skinya] Supabase SDK δεν φορτώθηκε — έλεγξε το <script> στο index.html');
}

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
