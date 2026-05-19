/* ====================================================================
   LEGAL.JS — Auto-build sticky TOC + scroll-spy για τις legal pages
   --------------------------------------------------------------------
   • Σκανάρει .legal-body section h2 → φτιάχνει <aside class="legal-toc">
   • Κάθε section παίρνει id="legal-{page}-{n}" για deep-linking
   • Scroll-spy: highlights active section στο TOC καθώς ο user κάνει scroll
   • Mobile: το TOC γίνεται collapsible — tap στον τίτλο toggle
   • Τρέχει μία φορά ανά legal page (idempotent)
   ==================================================================== */

const _legalProcessed = new Set();
let _legalScrollHandler = null;

function buildLegalTOC(pageId){
  if(_legalProcessed.has(pageId)) return;
  const page = document.getElementById(pageId);
  if(!page) return;
  const body = page.querySelector('.legal-body');
  if(!body) return;

  // Wrap body + new TOC in .legal-layout (κρατάει το original header έξω)
  // Αν δεν υπάρχει ήδη wrapper, τον φτιάχνουμε.
  let layout = page.querySelector('.legal-layout');
  if(!layout){
    layout = document.createElement('div');
    layout.className = 'legal-layout';
    body.parentNode.insertBefore(layout, body);
    layout.appendChild(body);
  }

  // Συλλέγει τα sections με h2
  const sections = Array.from(body.querySelectorAll(':scope > section'));
  if(!sections.length){ _legalProcessed.add(pageId); return; }

  // Assign ids + προσθέτει number badge στα h2
  const slug = pageId.replace('page-','');
  const tocItems = [];
  sections.forEach((sec, i)=>{
    const num = i + 1;
    if(!sec.id) sec.id = `legal-${slug}-${num}`;
    const h2 = sec.querySelector('h2');
    if(!h2) return;
    // Καθαρίζει το "1. " prefix αν υπάρχει στο h2 — θα μπει σαν badge
    let title = h2.textContent.trim();
    const match = title.match(/^(\d+)\.\s*(.+)$/);
    if(match){
      title = match[2];
      // Αναδιοργανώνει το h2 με badge
      h2.innerHTML = `<span class="h-num">${String(num).padStart(2,'0')}</span>${title}`;
    } else {
      h2.innerHTML = `<span class="h-num">${String(num).padStart(2,'0')}</span>${title}`;
    }
    tocItems.push({id:sec.id, num, title});
  });

  // Φτιάχνει το TOC aside
  const toc = document.createElement('aside');
  toc.className = 'legal-toc';
  toc.innerHTML = `
    <h4 class="legal-toc-title">On this page</h4>
    <ul class="legal-toc-list">
      ${tocItems.map(it=>`
        <li><a href="#${it.id}">
          <span class="toc-num">${String(it.num).padStart(2,'0')}</span>
          <span class="toc-text">${it.title}</span>
        </a></li>
      `).join('')}
    </ul>
  `;
  layout.insertBefore(toc, body);

  // Mobile collapse toggle στον τίτλο
  const tocTitle = toc.querySelector('.legal-toc-title');
  tocTitle.addEventListener('click', e=>{
    if(window.innerWidth <= 960){
      toc.classList.toggle('is-open');
    }
  });

  // Smooth scroll + close mobile drawer όταν πατάς link
  toc.addEventListener('click', e=>{
    const a = e.target.closest('a');
    if(!a) return;
    e.preventDefault();
    const targetId = a.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);
    if(target){
      const y = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({top:y, behavior:'smooth'});
      if(window.innerWidth <= 960) toc.classList.remove('is-open');
    }
  });

  _legalProcessed.add(pageId);
}

function setupLegalScrollSpy(pageId){
  const page = document.getElementById(pageId);
  if(!page) return;
  const sections = Array.from(page.querySelectorAll('.legal-body > section'));
  const links = Array.from(page.querySelectorAll('.legal-toc-list a'));
  if(!sections.length || !links.length) return;

  // Καθαρίζει τυχόν παλιό handler
  if(_legalScrollHandler){
    window.removeEventListener('scroll', _legalScrollHandler);
  }

  let ticking = false;
  function update(){
    const triggerY = window.scrollY + window.innerHeight * 0.25;
    let activeId = sections[0].id;
    for(const s of sections){
      if(s.offsetTop <= triggerY) activeId = s.id;
    }
    links.forEach(l=>{
      l.classList.toggle('is-active', l.getAttribute('href') === '#' + activeId);
    });
    ticking = false;
  }
  _legalScrollHandler = ()=>{
    if(!ticking){ requestAnimationFrame(update); ticking = true; }
  };
  window.addEventListener('scroll', _legalScrollHandler, {passive:true});
  update();
}

function initLegalPage(pageId){
  if(!pageId || !pageId.startsWith('page-')) return;
  if(!['page-terms','page-privacy','page-cookies'].includes(pageId)) return;
  buildLegalTOC(pageId);
  setupLegalScrollSpy(pageId);
}

// Wrapper γύρω από το navigateTo — όταν φτάνουμε σε legal page, init the TOC
(function wrapNavigateForLegal(){
  if(typeof window === 'undefined') return;
  // Run μετά από κάθε navigation: hook στο hashchange + ένα aftermath μετά το πρώτο load.
  window.addEventListener('hashchange', ()=>{
    const hash = location.hash.replace('#','');
    if(hash) initLegalPage('page-' + hash);
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    const hash = location.hash.replace('#','');
    if(hash) initLegalPage('page-' + hash);
    // Αν ο user πάει σε legal page από κλικ (όχι hashchange στο ίδιο route),
    // το navigateTo δεν trigger-άρει hashchange. Hook στο body click delegation:
    document.body.addEventListener('click', e=>{
      const link = e.target.closest('[data-route]');
      if(!link) return;
      const route = link.dataset.route;
      if(['terms','privacy','cookies'].includes(route)){
        setTimeout(()=>initLegalPage('page-' + route), 60);
      }
    });
  });
})();
