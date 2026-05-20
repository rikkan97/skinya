/* ====================================================================
   DATA.JS — Δεδομένα του site (κατηγορίες + προϊόντα + ετικέτες)
   --------------------------------------------------------------------
   ΕΔΩ προσθέτεις/αλλάζεις προϊόντα. Όταν συνδεθούμε με backend, αυτό
   το αρχείο θα αντικατασταθεί με fetch('/api/products').
   --------------------------------------------------------------------
   Σειρά κατηγοριών = K-beauty routine flow:
     01 Καθαρισμός → 02 Toners → 03 Serums → 04 Μάτια → 05 Κρέμες
     → 06 Αντηλιακά → Special: Μάσκες → Body: Χέρια & Πόδια
   --------------------------------------------------------------------
   Δομή προϊόντος:
   {
     id:'<uniqueId>',
     brand:'<Brand Name>',
     name:'<Full Product Name>',
     cat:'<categoryId>',          // αντιστοιχεί σε categories[].id
     size:'<π.χ. 250ml ή 70 pads>',
     img:'assets/products/<file>',// (optional) — αν λείπει, fallback σε brand initial
     keyIng:'<απλή φράση Ελληνικά>',     // εμφανίζεται στην κάρτα
     tech:'<τεχνικό όνομα συστατικού>',  // στο tooltip header
     techDesc:'<μια πρόταση εξήγησης>',  // στο tooltip body
     desc:'<αναλυτική περιγραφή>',       // εμφανίζεται μόνο σε featured
     featured:true,                       // (προαιρετικό) Best of Category
     badges:['cruelty-free','vegan',...]
   }
   ==================================================================== */

// ───── CATEGORIES (σε σειρά K-beauty routine) ─────
const categories = [
  {id:'cleansers',    name:'Καθαρισμός',          step:'Step 01', eyebrow:'Cleanse',    desc:'Το πρώτο βήμα — απομακρύνει ρύπους, makeup και αντηλιακό χωρίς να στερεί τη φυσική υγρασία.'},
  {id:'toners',       name:'Toners & Pads',       step:'Step 02', eyebrow:'Tonic',      desc:'Ισορροπία pH, καθαρισμός πόρων και καταπραϋντική φροντίδα.'},
  {id:'serums',       name:'Serums & Essences',   step:'Step 03', eyebrow:'Treatment',  desc:'Συγκεντρωμένη δράση — στοχευμένα συστατικά για κάθε ανάγκη της επιδερμίδας.'},
  {id:'eyes',         name:'Προϊόντα Ματιών',     step:'Step 04', eyebrow:'Eye Care',   desc:'Στοχευμένη φροντίδα για το βλέμμα — ρυτίδες, σακούλες, κούραση.'},
  {id:'moisturizers', name:'Κρέμες & Ενυδατικές', step:'Step 05', eyebrow:'Moisturize', desc:'Σφραγίζει την υγρασία και προστατεύει τον δερματικό φραγμό.'},
  {id:'spf',          name:'Αντηλιακά / SPF',     step:'Step 06', eyebrow:'Protect',    desc:'Το πιο σημαντικό βήμα anti-aging — καθημερινή προστασία από UV.'},
  {id:'masks',        name:'Μάσκες Προσώπου',     step:'Special', eyebrow:'Weekly',     desc:'Εβδομαδιαία τελετουργικά για βαθιά επανόρθωση και άμεσα ορατά αποτελέσματα.'},
  {id:'body',         name:'Χέρια & Πόδια',       step:'Body',    eyebrow:'Smooth',     desc:'Η ομορφιά δεν σταματάει στο πρόσωπο — βαθιά φροντίδα για κάθε σημείο.'}
];

// ───── ΠΡΟΕΠΙΛΕΓΜΕΝΕΣ ΤΙΜΕΣ ΑΝΑ ΚΑΤΗΓΟΡΙΑ ─────
// Αν ένα προϊόν δεν έχει specific `price` στο product object, παίρνει την
// προεπιλεγμένη τιμή της κατηγορίας του. Έτσι, για να αλλάξεις τιμή:
//   1) σε ολόκληρη κατηγορία → άλλαξε εδώ
//   2) σε συγκεκριμένο προϊόν → πρόσθεσε `price: 24.90` στο product
const CATEGORY_DEFAULT_PRICE = {
  cleansers:    18.90,
  toners:       22.90,
  serums:       28.90,
  eyes:         24.90,
  moisturizers: 26.90,
  spf:          19.90,
  masks:         9.90,
  body:         14.90
};
function getProductPrice(p){
  const { price } = getProductOffer(p);
  return price;
}

// Επιστρέφει { price, original, hasOffer, pct }
//   • price    : η τιμή που πρέπει να πληρώσει ο πελάτης
//   • original : η αρχική (διαγραμμένη) τιμή, μόνο όταν hasOffer
//   • hasOffer : true αν υπάρχει discount (price < default)
//   • pct      : ακέραιο ποσοστό έκπτωσης (π.χ. 25)
function getProductOffer(p){
  const def = (p.defaultPrice != null ? p.defaultPrice : null)
              ?? (CATEGORY_DEFAULT_PRICE[p.cat] || 19.90);
  const override = (p.price != null) ? p.price : null;
  if(override != null && def > 0 && override < def){
    return { price: override, original: def, hasOffer: true, pct: Math.round((1 - override/def) * 100) };
  }
  const finalPrice = (override != null) ? override : def;
  return { price: finalPrice, original: null, hasOffer: false, pct: 0 };
}

// Markup για τιμή: αν προσφορά → strike-through original + νέα τιμή + %
function renderPriceHTML(p){
  const o = getProductOffer(p);
  if(o.hasOffer){
    return `
      <span class="product-price product-price--offer">
        <span class="price-was">${o.original.toFixed(2)}€</span>
        <span class="price-now">${o.price.toFixed(2)}€</span>
        <span class="price-pct">−${o.pct}%</span>
      </span>
    `;
  }
  return `<span class="product-price">${o.price.toFixed(2)}€</span>`;
}

// ───── BADGE LABELS ─────
// Όταν προσθέτεις νέο badge σε προϊόν, βάλε εδώ το label του.
const badgeLabels = {
  'cruelty-free':'Cruelty Free',
  'vegan':'Vegan',
  'k-beauty':'K-Beauty',
  'alcohol-free':'Alcohol-Free',
  'fragrance-free':'Fragrance-Free',
  'spf-50':'SPF 50+',
  'sheet-mask':'Sheet Mask',
  'best-seller':'Best Seller',
  'viral':'TikTok Viral',
  'leaping-bunny':'Leaping Bunny ✓',
  'vegan-society':'Vegan Society ✓'
};

// Hover descriptions για κάθε badge (εμφανίζονται σε tooltip)
const badgeDescriptions = {
  'cruelty-free':'Δεν δοκιμάζεται σε ζώα.',
  'vegan':'Χωρίς συστατικά ζωικής προέλευσης.',
  'k-beauty':'Αυθεντικό Κορεάτικο skincare brand.',
  'alcohol-free':'Χωρίς αλκοόλη — ασφαλές για ευαίσθητο/ξηρό δέρμα.',
  'fragrance-free':'Χωρίς προσθήκη αρώματος — μειώνει ερεθισμό.',
  'spf-50':'Υψηλή αντηλιακή προστασία SPF50+ PA++++.',
  'sheet-mask':'Sheet mask σε αυτόνομη συσκευασία.',
  'best-seller':'Από τα πιο δημοφιλή προϊόντα της κατηγορίας.',
  'viral':'Έγινε viral στο TikTok — millions of views.',
  'leaping-bunny':'Επίσημα πιστοποιημένο cruelty-free από Leaping Bunny International — η πιο αξιόπιστη πιστοποίηση παγκοσμίως.',
  'vegan-society':'Επίσημα πιστοποιημένο vegan από The Vegan Society.'
};

// ───── BRAND CERTIFICATIONS ─────
// Επίσημες πιστοποιήσεις σε brand-level — προστίθενται αυτόματα σε όλα
// τα προϊόντα του brand μέσω της renderBadges() στο catalog.js.
// Πηγή: επίσημες δηλώσεις brands + Leaping Bunny / Vegan Society registries.
const brandCertifications = {
  'COSRX':           ['leaping-bunny'],
  'AXIS-Y':          ['leaping-bunny'],
  'Anua':            ['leaping-bunny'],
  'SKIN1004':        ['leaping-bunny'],
  'Beauty of Joseon':['leaping-bunny'],
  'Dr. Althea':      ['leaping-bunny','vegan-society']
};

// ───── PRODUCTS ─────
const products = [

  // ============ 01 · ΚΑΘΑΡΙΣΜΟΣ (Cleansers) ============
  {
    id:'cl1', brand:'Anua', name:'Heartleaf Pore Control Cleansing Oil', cat:'cleansers', size:'200ml',
    img:'assets/products/anua-heartleaf-pore-control-cleansing-oil-200ml.webp',
    keyIng:'Διπλός καθαρισμός — διαλύει SPF & makeup',
    tech:'10,000 PPM Heartleaf · Non-Comed Oil™',
    techDesc:'Λάδι καθαρισμού που διαλύει αντηλιακό, makeup και ρύπους χωρίς ξηρότητα και χωρίς να φράζει τους πόρους.',
    desc:'Το διάσημο K-beauty oil cleanser με Non-Comed Oil™ συμπύκνωμα 10,000 PPM heartleaf. Διαλύει αντηλιακό, waterproof makeup και ρύπους της ημέρας μαλακά, ξεπλένεται με νερό σε γαλάκτωμα και αφήνει το δέρμα καθαρό αλλά ενυδατωμένο.',
    featured:true,
    badges:['cruelty-free','vegan','k-beauty','best-seller']
  },
  {
    id:'cl2', brand:'SKIN1004', name:'Madagascar Centella Poremizing Deep Cleansing Foam', cat:'cleansers', size:'125ml',
    img:'assets/products/A0521AF3-319E-4DB2-8251-0AFB23F247BC_2048x.webp',
    keyIng:'Βαθύς καθαρισμός για ευαίσθητο δέρμα',
    tech:'100% Centella Asiatica + Γλυκερίνη',
    techDesc:'Καθαρίζει σε βάθος χωρίς να ξηραίνει — διατηρεί τον δερματικό φραγμό.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'cl3', brand:'Anua', name:'Heartleaf Quercetinol Pore Deep Cleansing Foam', cat:'cleansers', size:'150ml',
    img:'assets/products/anua-heartleaf-quercetinol-pore-deep-cleansing-foam-150ml-871722.webp',
    keyIng:'Αποσυμφόρηση πόρων & έλεγχος λιπαρότητας',
    tech:'Heartleaf + Quercetinol',
    techDesc:'Αποσυμφορώνει βαθιά τους πόρους και ισορροπεί τη λιπαρότητα.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'cl4', brand:'Holika Holika', name:'Daily Fresh Rice Cleansing Foam', cat:'cleansers', size:'150ml',
    img:'assets/products/20240404120730_08ea3389.jpeg',
    keyIng:'Φωτεινότητα & λάμψη',
    tech:'Εκχύλισμα Ρυζιού + Σαπωνίνες',
    techDesc:'Καθαρίζει βαθιά τους πόρους και χαρίζει άμεση λάμψη με παραδοσιακό συστατικό.',
    badges:['cruelty-free','k-beauty']
  },

  // ============ 02 · TONERS & PADS ============
  {
    id:'t1', brand:'Anua', name:'Heartleaf 77% Soothing Toner', cat:'toners', size:'250ml',
    img:'assets/products/xlarge_20240404120730_260ea86f.jpeg',
    keyIng:'Καταπραϋντικό για ευαίσθητο δέρμα',
    tech:'77% Houttuynia Cordata',
    techDesc:'Καταπραΰνει, μειώνει κοκκινίλες και ισορροπεί τον δερματικό φραγμό.',
    desc:'Το διάσημο K-beauty toner με 77% εκχύλισμα Houttuynia Cordata. Καταπραΰνει ερεθισμένο δέρμα, ισορροπεί τον φραγμό και ενυδατώνει ελαφρά χωρίς αλκοόλη ή άρωμα.',
    featured:true,
    badges:['cruelty-free','vegan','k-beauty','alcohol-free','fragrance-free','viral']
  },
  {
    id:'t2', brand:'SKIN1004', name:'Madagascar Centella Poremizing Clear Toner', cat:'toners', size:'210ml',
    img:'assets/products/DDAD9E9A-3950-4AD5-893A-38C57AEA5496.webp',
    keyIng:'Σύσφιξη πόρων & ήπια απολέπιση',
    tech:'4-HAs (AHA · BHA · PHA · LHA) + Pink Mineral Salt',
    techDesc:'Συνδυασμός 4 ήπιων οξέων και ορυκτών αλάτων που καθαρίζει πόρους και απολεπίζει χωρίς ερεθισμό.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'t3', brand:'Anua', name:'Azelaic 10 Hyaluron Redness Soothing Pad', cat:'toners', size:'90 pads',
    img:'assets/products/3824_kopie_3fdd44c3-88cd-46ed-b1c7-c7fbfc80fa38.webp',
    keyIng:'Κατά ακμής & κοκκινίλας',
    tech:'10% Azelaic Acid + Υαλουρονικό',
    techDesc:'Καταπολεμά ακμή, μειώνει κηλίδες και ενυδατώνει βαθιά.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'t4', brand:'Anua', name:'Niacinamide 5 + TXA 2 Brightening Pad', cat:'toners', size:'60 pads',
    img:'assets/products/Anua_Niacinamide5TXABrighteningPad210ml_3.webp',
    keyIng:'Λάμψη & μείωση κηλίδων',
    tech:'5% Niacinamide + 2% Τρανεξαμικό Οξύ',
    techDesc:'Στοχεύει σκούρες κηλίδες, σημάδια ακμής και melasma για ομοιόμορφο τόνο.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'t5', brand:'PUREDERM', name:'Red Signal Peeling Pads', cat:'toners', size:'12 pads',
    img:'assets/products/purederm-red-signal.jpg',
    keyIng:'Τριπλή απολέπιση & ανανέωση',
    tech:'AHA · BHA · PHA · LHA',
    techDesc:'Απομακρύνει νεκρά κύτταρα, καθαρίζει πόρους και ανανεώνει την επιδερμίδα.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'t6', brand:'Medicube', name:'Zero Pore Pad 2.0', cat:'toners', size:'70 pads',
    img:'assets/products/medicube-zero-pore.jpg',
    keyIng:'Σύσφιξη πόρων & έλεγχος λιπαρότητας',
    tech:'4.5% AHA (Lactic) + 0.45% BHA (Salicylic)',
    techDesc:'AHA λειαίνει την υφή ενώ το σαλικυλικό καθαρίζει τους πόρους σε βάθος.',
    badges:['cruelty-free','k-beauty']
  },

  // ============ 03 · SERUMS & ESSENCES ============
  {
    id:'s1', brand:'COSRX', name:'Advanced Snail 96 Mucin Power Essence', cat:'serums', size:'100ml',
    img:'assets/products/advanced-snail-96-mucin-power-essence-3419988.webp',
    keyIng:'Επανόρθωση & βαθιά ενυδάτωση',
    tech:'96% Snail Mucin',
    techDesc:'Επιταχύνει την ανάπλαση κυττάρων και ομαλοποιεί την υφή.',
    desc:'Το πιο διάσημο K-beauty essence παγκοσμίως. 96% εκχύλισμα σαλιγκαριού που επιδιορθώνει, ενυδατώνει σε βάθος και προετοιμάζει το δέρμα να απορροφήσει τα υπόλοιπα προϊόντα της ρουτίνας. Iconic, με αποδεδειγμένα αποτελέσματα.',
    featured:true,
    badges:['cruelty-free','k-beauty','best-seller','viral']
  },
  {
    id:'s2', brand:'COSRX', name:'The 6 Peptide Skin Booster Serum', cat:'serums', size:'150ml',
    img:'assets/products/6 peptide.webp',
    keyIng:'Σύσφιξη & αντιγήρανση',
    tech:'6 Πεπτίδια + Niacinamide',
    techDesc:'Ενισχύει το κολλαγόνο και βελτιώνει την ελαστικότητα.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'s3', brand:'COSRX', name:'The Vitamin C 23 Serum', cat:'serums', size:'20ml',
    img:'assets/products/c23.webp',
    keyIng:'Λάμψη & ομοιόμορφος τόνος',
    tech:'23% Καθαρή Βιταμίνη C',
    techDesc:'Φωτεινότητα, μείωση κηλίδων και προστασία από οξειδωτικό στρες.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'s4', brand:'NINE LESS', name:'B-Boost 10% Niacinamide Serum', cat:'serums', size:'30ml',
    img:'assets/products/b boost 10%.webp',
    keyIng:'Ισορροπία λιπαρότητας & λάμψη',
    tech:'10% Niacinamide',
    techDesc:'Ρυθμίζει σμίγμα, μειώνει πόρους και ομοιομορφοποιεί τον τόνο.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'s5', brand:'CELIMAX', name:'The Vita-A Retinal Shot Tightening Booster', cat:'serums', size:'15ml',
    keyIng:'Δυνατή αντιγήρανση & σύσφιξη',
    tech:'0.1% Retinal + 3% Matrixyl',
    techDesc:'Πιο γρήγορη μορφή ρετινόλης — λειτουργεί 11x ταχύτερα κατά των ρυτίδων.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'s6', brand:'SKIN1004', name:'Madagascar Centella Poremizing Fresh Ampoule', cat:'serums', size:'100ml',
    keyIng:'Σύσφιξη πόρων & ελαστικότητα',
    tech:'Pink Mineral Salt + 9 Peptides + Centella',
    techDesc:'Καθαρίζει πόρους, βελτιώνει ελαστικότητα — υγρή υφή που δεν κολλάει.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'s7', brand:'SKIN1004', name:'Retinol 0.2 Boosting Shot Ampoule', cat:'serums', size:'30ml',
    keyIng:'Ήπια αντιγήρανση για αρχάριους',
    tech:'0.2% Καθαρή Ρετινόλη',
    techDesc:'Στοχευμένη δράση κατά ρυτίδων και χαλάρωσης — κατάλληλη για εισαγωγή σε ρετινόλη.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'s8', brand:'SKIN1004', name:'Niacinamide 10 Boosting Shot Ampoule', cat:'serums', size:'30ml',
    keyIng:'Φωτεινότητα & σύσφιξη πόρων',
    tech:'10% Niacinamide',
    techDesc:'Ομοιόμορφος τόνος, λιγότερες κηλίδες, σφιγμένοι πόροι.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'s9', brand:'AXIS-Y', name:'Dark Spot Correcting Glow Serum', cat:'serums', size:'50ml',
    keyIng:'Στόχευση κηλίδων & λάμψη',
    tech:'5% Niacinamide + Squalane + Papaya',
    techDesc:'Μειώνει σκούρες κηλίδες και χαρίζει λάμψη χωρίς να ερεθίζει.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'s10', brand:'Medicube', name:'Deep Reviving Bakuchiol + Retinol Serum', cat:'serums', size:'30ml',
    img:'assets/products/deep reviving.webp',
    keyIng:'Δυνατή αντιγήρανση 24ώρου',
    tech:'Ενθυλακωμένη Ρετινόλη + Bakuchiol',
    techDesc:'Συνδυασμός ρετινόλης + φυτικής εναλλακτικής για 24ωρη δράση κατά ρυτίδων.',
    badges:['cruelty-free','k-beauty']
  },

  // ============ 04 · ΜΑΤΙΑ (Eye Care) ============
  {
    id:'e1', brand:'Beauty of Joseon', name:'Revive Eye Serum Ginseng + Retinal', cat:'eyes', size:'30ml',
    img:'assets/products/revive eye.webp',
    keyIng:'Αντιγήρανση & ενυδάτωση ματιών',
    tech:'Ginseng + Retinal',
    techDesc:'Μειώνει ρυτίδες, σακούλες και μαύρους κύκλους.',
    desc:'Συνδυάζει το παραδοσιακό κορεάτικο ginseng με σύγχρονη ρετινάλη. Στοχεύει ρυτίδες, σακούλες και κούραση — και ταυτόχρονα ενυδατώνει βαθιά την ευαίσθητη περιοχή των ματιών.',
    featured:true,
    badges:['cruelty-free','k-beauty','best-seller']
  },
  {
    id:'e2', brand:'Numbuzin', name:'No.9 NAD+ Collagen Under Eye Patches', cat:'eyes', size:'5 ζευγάρια',
    img:'assets/products/numbuzin.webp',
    keyIng:'Instant glow — ενυδάτωση & σύσφιξη',
    tech:'NAD+ + Marine Collagen + 50 Peptides',
    techDesc:'Patches που χαρίζουν άμεση φρεσκάδα και μειώνουν σακούλες.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'e3', brand:'Medicube', name:'Deep Reviving Peptide Eye Cream', cat:'eyes', size:'30ml',
    keyIng:'Lifting ματιών + προσώπου',
    tech:'Πεπτίδια + EGF',
    techDesc:'Σφίγγει, ενυδατώνει — κατάλληλη και για ολόκληρο το πρόσωπο.',
    badges:['cruelty-free','k-beauty']
  },

  // ============ 05 · ΚΡΕΜΕΣ & ΕΝΥΔΑΤΙΚΕΣ ============
  {
    id:'m1', brand:'COSRX', name:'Advanced Snail 92 All In One Cream', cat:'moisturizers', size:'100g',
    img:'assets/products/92 snail all in once.webp',
    keyIng:'Επανόρθωση & βαθιά ενυδάτωση',
    tech:'92% Snail Mucin',
    techDesc:'Επιδιορθώνει, ενυδατώνει και ομαλοποιεί την υφή — όλα σε ένα βήμα.',
    desc:'Η πιο pure cream της COSRX με 92% εκχύλισμα σαλιγκαριού. Ομαλοποιεί την υφή, ενυδατώνει σε βάθος και επιταχύνει την ανάπλαση. Iconic στο K-beauty κοινό για ευαίσθητο, ξηρό ή στρεσαρισμένο δέρμα.',
    featured:true,
    badges:['cruelty-free','k-beauty','best-seller']
  },
  {
    id:'m2', brand:'Dr. Althea', name:'345 Relief Cream', cat:'moisturizers', size:'50ml',
    img:'assets/products/Dr.Althea_345_Relief_Cream1.jpg',
    keyIng:'Καταπραϋντική για ευαίσθητο δέρμα',
    tech:'12 ενεργά: Niacinamide + Centella + Ceramide NP',
    techDesc:'3 για κηλίδες + 4 θρεπτικά + 5 καταπραϋντικά — vegan certified.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'m3', brand:'NINE LESS', name:'A-Control Azelaic Acid Cream', cat:'moisturizers', size:'50ml',
    img:'assets/products/NINELESS-a-control-azelaic-acid-cream-hover_1024x1024.webp',
    keyIng:'Έλεγχος ακμής & πόρων',
    tech:'10,000 ppm Αζελαϊκό Οξύ + Niacinamide',
    techDesc:'Μειώνει ακμή, κοκκινίλα και ορατούς πόρους.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'m4', brand:'SKIN1004', name:'Madagascar Centella Poremizing Light Gel Cream', cat:'moisturizers', size:'75ml',
    img:'assets/products/Madagascar Centella Poremizing Light Gel Cream.jpeg',
    keyIng:'Ελαφριά υφή — gel για λιπαρό δέρμα',
    tech:'Centella + Hyaluronic',
    techDesc:'Ενυδατώνει χωρίς να βαραίνει — ιδανική για μικτό ή λιπαρό δέρμα.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'m5', brand:'Mary & May', name:'Spicule Retinol PDRN Cream', cat:'moisturizers', size:'15g',
    keyIng:'Αντιγήρανση πολλαπλών επιπέδων',
    tech:'2,000ppm Marine Spicules + 0.1% Retinol + PDRN',
    techDesc:'Marine spicules μεταφέρουν retinol & PDRN βαθιά για αναζωογόνηση και σύσφιξη πόρων.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'m6', brand:'Medicube', name:'TXA Niacinamide Capsule Cream', cat:'moisturizers', size:'50ml',
    keyIng:'Λάμψη & ομοιόμορφος τόνος',
    tech:'TXA + Niacinamide Capsules',
    techDesc:'Capsules με τρανεξαμικό + νιασιναμίδη για στόχευση κηλίδων και melasma.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'m7', brand:'Medicube', name:'PDRN Pink Collagen Capsule Cream', cat:'moisturizers', size:'50ml',
    keyIng:'Σύσφιξη & επιδιόρθωση',
    tech:'PDRN + Κολλαγόνο',
    techDesc:'PDRN ενεργοποιεί την παραγωγή κολλαγόνου για σφιχτό δέρμα.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'m8', brand:'Medicube', name:'Deep Vita C Capsule Cream', cat:'moisturizers', size:'50ml',
    keyIng:'Καθημερινή λάμψη βιταμίνης C',
    tech:'Σταθεροποιημένη Vitamin C Capsules',
    techDesc:'Δίνει λάμψη και προστασία από οξειδωτικό στρες σε σταθερή μορφή.',
    badges:['cruelty-free','k-beauty']
  },

  // ============ 06 · ΑΝΤΗΛΙΑΚΑ / SPF ============
  {
    id:'sp1', brand:'Beauty of Joseon', name:'Relief Sun Rice + Probiotics SPF50+', cat:'spf', size:'50ml',
    img:'assets/products/Relief Sun Rice + Probiotics SPF50+.webp',
    keyIng:'Καθημερινή αντηλιακή προστασία',
    tech:'SPF50+ PA++++ · Rice + Probiotics',
    techDesc:'Ελαφρύ chemical sunscreen — αόρατο φινίρισμα, χωρίς white cast.',
    desc:'Το πιο αγαπημένο K-beauty αντηλιακό παγκοσμίως. Ελαφριά υφή σαν essence, αόρατο φινίρισμα, υψηλή προστασία SPF50+ PA++++. Προβιοτικά ενυδατώνουν και ηρεμούν — μπορεί να αντικαταστήσει και ενυδατική κρέμα.',
    featured:true,
    badges:['cruelty-free','vegan','k-beauty','spf-50','best-seller','viral']
  },
  {
    id:'sp2', brand:'SKIN1004', name:'HYALU-CICA Water-Fit Sun Serum SPF50+ PA++++', cat:'spf', size:'50ml',
    img:'assets/products/HYALU-CICA Water-Fit Sun Serum SPF50+ PA++++.webp',
    keyIng:'Ενυδατική προστασία',
    tech:'SPF50+ PA++++ · Cica + Hyaluronic',
    techDesc:'Water-fit υφή, ενυδάτωση και UV προστασία σε ένα.',
    badges:['cruelty-free','vegan','k-beauty','spf-50']
  },
  {
    id:'sp3', brand:'Beauty of Joseon', name:'Relief Sun Aqua-Fresh Rice + B5 SPF50+', cat:'spf', size:'50ml',
    img:'assets/products/Relief Sun Aqua-Fresh Rice + B5 SPF50+.webp',
    keyIng:'Δροσερή mat υφή για λιπαρό δέρμα',
    tech:'SPF50+ PA++++ · Rice + B5',
    techDesc:'Πιο δροσερή και mat έκδοση του classic Relief Sun.',
    badges:['cruelty-free','vegan','k-beauty','spf-50']
  },
  {
    id:'sp4', brand:'Jigott', name:'Signature All-In-One B.B Cream SPF50', cat:'spf', size:'50ml',
    img:'assets/products/jigott-sunscreen-cream-jigott-signature-all-in-one-b-b-cream-spf-50-pa-50ml-lolotagr-1200x1200.jpg.webp',
    keyIng:'BB cream + αντηλιακό σε ένα',
    tech:'SPF50 PA++ · Tinted Coverage',
    techDesc:'Καλύπτει ατέλειες ενώ προστατεύει από UV.',
    badges:['cruelty-free','k-beauty','spf-50']
  },

  // ============ MΑΣΚΕΣ ΠΡΟΣΩΠΟΥ (Weekly Treatment) ============
  {
    id:'mk1', brand:'Biodance', name:'Bio-Collagen Real Deep Mask', cat:'masks', size:'4 sheets',
    img:'assets/products/Bio-Collagen Real Deep Mask.webp',
    keyIng:'Overnight σύσφιξη & ενυδάτωση',
    tech:'Microneedle Collagen Film',
    techDesc:'Πιο πυκνή hydrogel μάσκα — αφήνεις όλη νύχτα για instant lifting.',
    desc:'Η πιο viral μάσκα του TikTok τα τελευταία χρόνια. Πυκνή hydrogel υφή που κολλάει στο δέρμα, μπορείς να την αφήσεις ακόμα και όλη νύχτα. Το ξύπνημα είναι σαν να μόλις βγήκες από spa: σφιγμένη, λεία, λαμπερή επιδερμίδα.',
    featured:true,
    badges:['cruelty-free','k-beauty','sheet-mask','viral']
  },
  {
    id:'mk2', brand:'Biodance', name:'Refreshing Sea Kelp Real Deep Mask', cat:'masks', size:'4 sheets',
    keyIng:'Καταπράυνση & ενυδάτωση',
    tech:'Sea Kelp Hydrogel',
    techDesc:'Δροσιστική hydrogel μάσκα που ηρεμεί ερεθισμένο δέρμα.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk3', brand:'Biodance', name:'Radiant Vita-Niacinamide Real Deep Mask', cat:'masks', size:'4 sheets',
    keyIng:'Λάμψη & ομοιόμορφος τόνος',
    tech:'Niacinamide + Vitamin Hydrogel',
    techDesc:'Πυκνή hydrogel μάσκα για άμεση λάμψη και ισορροπία τόνου.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk4', brand:'Biodance', name:'Hydro Cera-Nol Real Deep Mask', cat:'masks', size:'4 sheets',
    img:'assets/products/Hydro Cera-Nol Real Deep Mask.jpg',
    keyIng:'Επιδιόρθωση δερματικού φραγμού',
    tech:'Κεραμίδια + Πανθενόλη',
    techDesc:'Επανορθωτική μάσκα για ξηρό, ταλαιπωρημένο δέρμα.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk5', brand:'Biodance', name:'Rejuvenating Caviar PDRN Real Deep Mask', cat:'masks', size:'4 sheets',
    keyIng:'Premium αντιγήρανση',
    tech:'Χαβιάρι + PDRN',
    techDesc:'Σύσφιξη, λάμψη, αναζωογόνηση με δύο luxury συστατικά.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk6', brand:'Medicube', name:'PDRN Pink Collagen Gel Mask', cat:'masks', size:'1 pc',
    keyIng:'Σύσφιξη με PDRN',
    tech:'PDRN + Pink Collagen',
    techDesc:'Gel μάσκα που σφραγίζει συστατικά και ενεργοποιεί κολλαγόνο.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'mk7', brand:'Medicube', name:'Collagen Lifting Mask', cat:'masks', size:'1 pc',
    keyIng:'Άμεσο lifting effect',
    tech:'Κολλαγόνο + Πεπτίδια',
    techDesc:'Σφίγγει και ορίζει τα περιγράμματα του προσώπου.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'mk8', brand:'Medicube', name:'Collagen Night Wrapping Mask', cat:'masks', size:'70ml',
    keyIng:'Overnight αντιγηραντική θεραπεία',
    tech:'Κολλαγόνο Sleeping Mask',
    techDesc:'Wrapping υφή που σφραγίζει την υγρασία όλη τη νύχτα.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'mk9', brand:'Medicube', name:'Zero Pore Blackhead Mud Mask', cat:'masks', size:'70ml',
    keyIng:'Βαθύς καθαρισμός μαύρων στιγμάτων',
    tech:'Λάσπη + Σαλικυλικό',
    techDesc:'Απορροφά λιπαρότητα και τραβάει μαύρα στίγματα από τη μύτη και το πιγούνι.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'mk10', brand:'SKIN1004', name:'Poremizing Quick Clay Stick Mask', cat:'masks', size:'30g',
    keyIng:'Stick μάσκα — στοχευμένη',
    tech:'Λάσπη + Salt + Centella',
    techDesc:'Stick που εφαρμόζεται κατευθείαν σε προβληματικές περιοχές.',
    badges:['cruelty-free','vegan','k-beauty']
  },
  {
    id:'mk11', brand:'Jigott', name:'Pure Clean Charcoal Peel Off Mask', cat:'masks', size:'180ml',
    keyIng:'Βαθύς καθαρισμός peel-off',
    tech:'Ενεργός Άνθρακας',
    techDesc:'Peel-off μάσκα που τραβάει ρύπους και νεκρά κύτταρα.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'mk12', brand:'Jigott', name:'Caviar Real Ampoule Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Premium αντιγήρανση',
    tech:'Εκχύλισμα Χαβιαριού',
    techDesc:'Πλούσια θρέψη και σύσφιξη με πολυτελές συστατικό.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk13', brand:'Jigott', name:'Cucumber Real Ampoule Mask', cat:'masks', size:'1 sheet',
    keyIng:'Δροσιστική καταπραϋντική',
    tech:'Εκχύλισμα Αγγουριού',
    techDesc:'Δροσίζει και ηρεμεί ταλαιπωρημένο δέρμα από ήλιο.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk14', brand:'Jigott', name:'Collagen Real Ampoule Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Σύσφιξη & ελαστικότητα',
    tech:'Υδρολυμένο Κολλαγόνο',
    techDesc:'Κάνει το δέρμα πιο σφιχτό και ελαστικό σε μία χρήση.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk15', brand:'Jigott', name:'Hyaluronic Acid Real Ampoule Mask', cat:'masks', size:'1 sheet',
    keyIng:'Έντονη ενυδάτωση',
    tech:'Υαλουρονικό Οξύ',
    techDesc:'Plump effect — μετά τη χρήση το δέρμα φαίνεται γεμάτο.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk16', brand:'Jigott', name:'Pomegranate Real Ampoule Mask', cat:'masks', size:'1 sheet',
    keyIng:'Αντιοξειδωτική προστασία',
    tech:'Εκχύλισμα Ροδιού',
    techDesc:'Αντιοξειδωτικά για λάμψη και προστασία από στρες περιβάλλοντος.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk17', brand:'Jigott', name:'Multi-Vitamin Face Mask', cat:'masks', size:'1 sheet',
    keyIng:'Καθημερινή λάμψη βιταμινών',
    tech:'Vitamin Complex',
    techDesc:'Συνδυασμός βιταμινών για άμεση λάμψη και φρεσκάδα.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk18', brand:'SKIN627', name:'Ceramide with Panthenol Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Επιδιόρθωση φραγμού',
    tech:'Κεραμίδια + Πανθενόλη',
    techDesc:'Ξαναχτίζει τον δερματικό φραγμό σε ευαίσθητο δέρμα.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk19', brand:'SKIN627', name:'Hyaluron with Squalane Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Διπλή ενυδάτωση',
    tech:'Υαλουρονικό + Σκουαλάνη',
    techDesc:'Δύο επίπεδα ενυδάτωσης — επιφάνεια και βάθος.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk20', brand:'SKIN627', name:'Collagen with Peptide Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Σύσφιξη & αντιγήρανση',
    tech:'Κολλαγόνο + Πεπτίδια',
    techDesc:'Συνδυασμός για άμεσο firming αποτέλεσμα.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk21', brand:'SKIN627', name:'Retinol with Pearl Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Λάμψη & αντιγήρανση',
    tech:'Ρετινόλη + Pearl Extract',
    techDesc:'Ρετινόλη για ρυτίδες, μαργαριτάρι για λάμψη.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },
  {
    id:'mk22', brand:'SKIN627', name:'Vitamin with Niacinamide Sheet Mask', cat:'masks', size:'1 sheet',
    keyIng:'Φωτεινότητα & ομοιόμορφος τόνος',
    tech:'Vitamin C + Niacinamide',
    techDesc:'Διπλή στόχευση κηλίδων και έντονη λάμψη.',
    badges:['cruelty-free','k-beauty','sheet-mask']
  },

  // ============ ΧΕΡΙΑ & ΠΟΔΙΑ (Body Ritual) ============
  {
    id:'b1', brand:'Jigott', name:'Secret Garden Edelweiss Hand Cream', cat:'body', size:'100ml',
    img:'assets/products/Secret Garden Edelweiss Hand Cream.webp',
    keyIng:'Ενυδατική φροντίδα χεριών',
    tech:'Edelweiss + Σηπτυρεριά',
    techDesc:'Λεπτή υφή, βαθιά ενυδάτωση, μη λιπαρή.',
    desc:'Κρέμα χεριών με εκχύλισμα Edelweiss — του ορεινού λουλουδιού των Άλπεων που είναι γνωστό για τις αντιοξειδωτικές του ιδιότητες. Λεπτή, μη λιπαρή υφή που απορροφάται γρήγορα και αφήνει τα χέρια απαλά για ώρες.',
    featured:true,
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'b2', brand:'PUREDERM', name:'Heating Moisture Foot Mask', cat:'body', size:'1 pair',
    img:'assets/products/PUREDERM_PD_Heating_Moisture_Foot_Mask_1_pair.webp',
    keyIng:'Θερμαντική θεραπεία ποδιών',
    tech:'Self-Heating Activation',
    techDesc:'Self-heating μάσκα που ενυδατώνει και χαλαρώνει κουρασμένα πόδια.',
    badges:['cruelty-free','k-beauty']
  },
  {
    id:'b3', brand:'PUREDERM', name:'Crystal Nose Pore Strips', cat:'body', size:'6 strips',
    img:'assets/products/Crystal Nose Pore Strips.jpg',
    keyIng:'Καθαρισμός μαύρων στιγμάτων μύτης',
    tech:'Adhesive Pore Strips',
    techDesc:'Καθαρίζουν μηχανικά τους πόρους της μύτης από μαύρα στίγματα.',
    badges:['cruelty-free','k-beauty']
  }
];

/* ─────────────────────────────────────────────────────────────────
   API LAYER (placeholder για μελλοντικό backend)
   -------------------------------------------------------------------
   Σήμερα: επιστρέφουν το local data array.
   Αύριο (όταν φτιάξεις backend): αλλάζεις ΜΟΝΟ αυτές τις 3 συναρτήσεις
   ώστε να καλούν fetch('/api/...'). Το υπόλοιπο site δεν χρειάζεται
   αλλαγή — επειδή πάντα ζητάει δεδομένα μέσω αυτών των functions.
   ───────────────────────────────────────────────────────────────── */

async function fetchProducts(){
  // ΜΕΛΛΟΝ: return (await fetch('/api/products')).json();
  return products;
}

async function fetchCategories(){
  // ΜΕΛΛΟΝ: return (await fetch('/api/categories')).json();
  return categories;
}

async function fetchBadgeLabels(){
  // ΜΕΛΛΟΝ: return (await fetch('/api/badges')).json();
  return badgeLabels;
}
