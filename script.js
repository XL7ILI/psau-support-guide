const categoriesList = document.getElementById("categoriesList");
const viewer = document.getElementById("viewer");
const resultsContainer = document.getElementById("results");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");

let servicesData = [];
let activeCategoryIndex = 0;

async function loadData(){
  try{
    const response = await fetch("data/services.json");
    if(!response.ok) throw new Error("Failed to load services.json");
   const data = await response.json();
servicesData = data.categories;
    updateStats();
    renderCategories();
    showCategory(0);
  }catch(error){
    viewer.innerHTML = `<div class="emptyState"><h3>تعذر تحميل البيانات</h3><p>تأكدي أن Live Server شغال وأن ملف data/services.json موجود.</p></div>`;
    console.error(error);
  }
}

function updateStats(){
  const categories = servicesData.length;
  const subcategories = servicesData.reduce((sum, cat) => sum + (cat.subcategories || []).length, 0);
  const items = servicesData.reduce((sum, cat) => sum + (cat.subcategories || []).reduce((s, sub) => s + (sub.items || []).length, 0), 0);
  document.getElementById("categoryCount").textContent = categories;
  document.getElementById("subcategoryCount").textContent = subcategories;
  document.getElementById("itemCount").textContent = items;
}

function renderCategories(){
  categoriesList.innerHTML = servicesData.map((cat, index) => {
    const subs = cat.subcategories || [];
    const itemCount = subs.reduce((sum, sub) => sum + (sub.items || []).length, 0);
    return `<button class="category-tab" data-cat="${index}">
      <span class="tab-title"><span>📁</span><b>${escapeHtml(cat.nameEn)} ${escapeHtml(cat.nameAr)}</b></span>
      <span class="badge">${subs.length} / ${itemCount}</span>
    </button>`;
  }).join("");
}

function showCategory(catIndex, subIndex = null, itemText = null){
  activeCategoryIndex = Number(catIndex);
  const cat = servicesData[activeCategoryIndex];
  if(!cat) return;

  document.querySelectorAll(".category-tab").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.cat) === activeCategoryIndex);
  });

  const subs = cat.subcategories || [];
  const itemCount = subs.reduce((sum, sub) => sum + (sub.items || []).length, 0);

  viewer.innerHTML = `<div class="viewer-head">
    <div class="viewer-title">
      <h2>📂 ${escapeHtml(cat.name)}</h2>
      <p>اختاري فئة فرعية لعرض البنود التابعة لها.</p>
    </div>
    <div class="viewer-summary">
      <span class="summary-pill">${subs.length} فئة فرعية</span>
      <span class="summary-pill">${itemCount} بند</span>
    </div>
  </div>
  <div class="sub-grid">
    ${subs.map((sub, idx) => renderSubCard(sub, idx, subIndex, itemText)).join("")}
  </div>`;

  if(subIndex !== null){
    setTimeout(() => {
      const target = viewer.querySelector(`.sub-card[data-sub="${subIndex}"]`);
      if(target) target.scrollIntoView({behavior:"smooth", block:"center"});
    }, 100);
  }
}

function renderSubCard(sub, idx, selectedSub, selectedItem){
  const isSelected = Number(selectedSub) === idx;
  const items = sub.items || [];
  const itemsHtml = items.length
    ? items.map(item => `<div class="item ${selectedItem && normalizeText(item) === normalizeText(selectedItem) ? "selected" : ""}">📄 ${escapeHtml(item)}</div>`).join("")
    : `<div class="item empty-item">لا توجد بنود مسجلة تحت هذه الفئة</div>`;

  return `<article class="sub-card ${isSelected ? "open selected" : ""}" data-sub="${idx}">
    <button class="sub-header" type="button">
      <span class="sub-name"><span class="arrow">◀</span><span>📁 ${escapeHtml(sub.name)}</span></span>
      <span class="badge">${items.length} بند</span>
    </button>
    <div class="items">${itemsHtml}</div>
  </article>`;
}

document.addEventListener("click", (event) => {
  const catBtn = event.target.closest(".category-tab");
  if(catBtn){
    resultsContainer.classList.add("hidden");
    resultsContainer.innerHTML = "";
    searchInput.value = "";
    showCategory(catBtn.dataset.cat);
    return;
  }

  const subHeader = event.target.closest(".sub-header");
  if(subHeader){
    subHeader.closest(".sub-card").classList.toggle("open");
    return;
  }

  const result = event.target.closest(".result-card[data-cat]");
  if(result){
    openSearchResult(result.dataset.cat, result.dataset.sub, result.dataset.item || "");
  }
});

searchInput.addEventListener("input", () => {
  const query = normalizeText(searchInput.value);
  if(!query){
    resultsContainer.innerHTML = "";
    resultsContainer.classList.add("hidden");
    return;
  }

  const results = [];

  servicesData.forEach((cat, catIndex) => {
    const subs = cat.subcategories || [];
    if(normalizeText(cat.name).includes(query)){
      subs.forEach((sub, subIndex) => results.push({type:"تصنيف", cat, sub, item:null, catIndex, subIndex}));
    }

    subs.forEach((sub, subIndex) => {
      if(normalizeText(sub.name).includes(query)) results.push({type:"فئة فرعية", cat, sub, item:null, catIndex, subIndex});
      (sub.items || []).forEach(item => {
        if(normalizeText(item).includes(query)) results.push({type:"بند", cat, sub, item, catIndex, subIndex});
      });
    });
  });

  renderResults(results, searchInput.value);
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  resultsContainer.innerHTML = "";
  resultsContainer.classList.add("hidden");
  searchInput.focus();
});

function renderResults(results, query){
  resultsContainer.classList.remove("hidden");
  if(!results.length){
    resultsContainer.innerHTML = `<div class="result-card"><div class="result-main">لا توجد نتائج مطابقة.</div></div>`;
    return;
  }

  const limited = results.slice(0, 30);
  resultsContainer.innerHTML = `<h3 class="results-title">نتائج البحث</h3>` + limited.map(r => `<div class="result-card" data-cat="${r.catIndex}" data-sub="${r.subIndex}" data-item="${escapeAttr(r.item || "")}">
    <div class="result-path">${escapeHtml(r.cat.name)} ← ${escapeHtml(r.sub.name)}</div>
    <div class="result-main">${r.item ? "📄" : "📁"} ${highlight(r.item || r.sub.name, query)}</div>
    <span class="result-note">اضغطي لفتحها داخل الدليل</span>
  </div>`).join("");
}

function openSearchResult(catIndex, subIndex, itemText){
  searchInput.value = "";
  resultsContainer.innerHTML = "";
  resultsContainer.classList.add("hidden");
  showCategory(Number(catIndex), Number(subIndex), itemText || null);
}

function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

function escapeHtml(text){
  return String(text || "").replace(/[&<>"]/g, function(c){
    return {"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"}[c];
  });
}

function escapeAttr(text){
  return escapeHtml(text).replace(/'/g, "&#39;");
}

function highlight(text, query){
  const safe = escapeHtml(text);
  if(!query) return safe;
  const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try{
    return safe.replace(new RegExp(escaped, "gi"), match => `<mark>${match}</mark>`);
  }catch{
    return safe;
  }
}

loadData();
