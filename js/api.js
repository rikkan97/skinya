/* ====================================================================
   API.JS — Supabase data layer (αντικαθιστά τα local data του data.js)
   --------------------------------------------------------------------
   • loadDataFromSupabase()  — φέρνει products + categories από DB και
                                γεμίζει τα global arrays (products / categories)
   • fetchProductsDB()       — επιστρέφει fresh data από DB
   • fetchCategoriesDB()     — επιστρέφει fresh data από DB
   • mapProduct()/mapCategory() — μετατρέπουν DB rows σε format που
                                  περιμένει το frontend (data.js shape)
   --------------------------------------------------------------------
   Σχήμα DB → Σχήμα Frontend:
     sku            → id
     brand_id       → brand (name via JOIN)
     category_id    → cat
     key_ingredient → keyIng
     tech_name      → tech
     tech_desc      → techDesc
     description    → desc
     is_featured    → featured
   ==================================================================== */

function mapProduct(row){
  // row.brand = { name: 'Anua' } (from JOIN with brands table)
  return {
    id:       row.sku,
    name:     row.name,
    brand:    row.brand?.name || '',
    cat:      row.category_id,
    size:     row.size || '',
    img:      row.img || null,
    keyIng:   row.key_ingredient || '',
    tech:     row.tech_name || '',
    techDesc: row.tech_desc || '',
    desc:     row.description || '',
    featured: !!row.is_featured,
    price:    row.price != null ? Number(row.price) : null,
    stock:    row.stock,
    badges:   Array.isArray(row.badges) ? row.badges : []
  };
}

function mapCategory(row){
  return {
    id:      row.id,
    name:    row.name,
    step:    row.step || '',
    eyebrow: row.eyebrow || '',
    desc:    row.description || ''
  };
}

async function fetchProductsDB(){
  const { data, error } = await window.sb
    .from('products')
    .select('sku, name, brand_id, category_id, size, img, key_ingredient, tech_name, tech_desc, description, price, default_price, stock, is_featured, badges, brand:brands(name)')
    .eq('is_active', true);

  if(error){
    console.error('[Skinya] fetchProductsDB error:', error);
    return [];
  }
  return data.map(mapProduct);
}

async function fetchCategoriesDB(){
  const { data, error } = await window.sb
    .from('categories')
    .select('id, name, step, eyebrow, description, sort_order')
    .order('sort_order');

  if(error){
    console.error('[Skinya] fetchCategoriesDB error:', error);
    return [];
  }
  return data.map(mapCategory);
}

/* --------------------------------------------------------------------
   loadDataFromSupabase
   Καλείται στην αρχή του DOMContentLoaded — γεμίζει τα global arrays
   ΠΡΙΝ ξεκινήσουν τα renders. Αν αποτύχει το DB, διατηρεί το local
   fallback data του data.js.
   -------------------------------------------------------------------- */
async function loadDataFromSupabase(){
  try {
    const [dbProducts, dbCategories] = await Promise.all([
      fetchProductsDB(),
      fetchCategoriesDB()
    ]);

    if(dbProducts.length){
      products.splice(0, products.length, ...dbProducts);
    }
    if(dbCategories.length){
      categories.splice(0, categories.length, ...dbCategories);
    }
    const uniqueBrands = new Set(products.map(p=>p.brand).filter(Boolean));
    console.log(`[Skinya] Loaded ${products.length} products, ${categories.length} categories, ${uniqueBrands.size} brands from Supabase ✓`);
    return true;
  } catch(e){
    console.warn('[Skinya] Supabase load απέτυχε — χρησιμοποιώ local fallback:', e);
    return false;
  }
}

// Override των fetchProducts/fetchCategories του data.js ώστε να
// επιστρέφουν fresh data από DB όταν καλούνται direct.
async function fetchProducts(){ return await fetchProductsDB(); }
async function fetchCategories(){ return await fetchCategoriesDB(); }
