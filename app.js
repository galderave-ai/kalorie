// Stan aplikacji
let appState = {
    targetKcal: 2000,
    products: [], // { id, name, kcal, protein, carbs, fat }
    meals: [],    // { id, name, ingredients: [{productId, weight}] }
    diary: {},    // { "YYYY-MM-DD": [ { id, productId, weight } ] }
    activities: {}, // { "YYYY-MM-DD": [ { id, name, kcal } ] }
    weights: {},  // { "YYYY-MM-DD": 85.5 }
    currentDate: new Date()
};

// Stan tymczasowy dla kreatora dań
let mealBuilderIngredients = [];

// Pomocnicze funkcje daty
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function getDisplayDate(dateStr) {
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    
    if (dateStr === today) return "Dzisiaj";
    if (dateStr === yesterday) return "Wczoraj";
    
    const parts = dateStr.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// Generowanie ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB__nj5cQTRgU23OF6GgkDUX2iJd0u2zMw",
  authDomain: "moje-kalorie-76cef.firebaseapp.com",
  projectId: "moje-kalorie-76cef",
  storageBucket: "moje-kalorie-76cef.firebasestorage.app",
  messagingSenderId: "442776070894",
  appId: "1:442776070894:web:fac73e0083a5ed48f4a1ff",
  measurementId: "G-BPNDZJ9EW5"
};

// Inicjalizacja Firebase i Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
let docRef = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Użytkownik zalogowany - bierzemy JEGO dokument
        docRef = db.collection("kalorie_data").doc(user.uid);
        
        document.getElementById('view-login').classList.remove('active');
        document.getElementById('main-nav').style.display = 'grid';
        
        await init();
    } else {
        // Niezalogowany - pokazujemy ekran logowania
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-login').classList.add('active');
        document.getElementById('main-nav').style.display = 'none';
    }
});

// Inicjalizacja (wywoływana DOPIERO po zalogowaniu)
async function init() {
    setupNavigation();
    setupEventListeners();
    
    try {
        await loadData();
    } catch (error) {
        console.error("Błąd Firebase:", error);
        // Fallback: ładujemy z localStorage jeśli Firebase zawiódł
        loadFromLocalStorage();
    }

    if (appState.targetKcal === 2000 && appState.products.length === 0 && Object.keys(appState.diary).length === 0) {
        switchView('view-settings');
    } else {
        switchView('view-diary');
    }
    
    renderAll();
}

// Baza Danych (Firebase)
async function loadData() {
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data.targetKcal) appState.targetKcal = data.targetKcal;
        if (data.products) appState.products = data.products;
        if (data.meals) appState.meals = data.meals;
        if (data.diary) appState.diary = data.diary;
        if (data.activities) appState.activities = data.activities;
        if (data.weights) appState.weights = data.weights;
        if (data.geminiApiKey) appState.geminiApiKey = data.geminiApiKey;
    } else {
        loadFromLocalStorage();
        await saveData(); // Wypchnij do chmury
    }
}

function loadFromLocalStorage() {
    const savedKcal = localStorage.getItem('targetKcal');
    if (savedKcal) {
        appState.targetKcal = parseInt(savedKcal, 10);
        const savedProducts = localStorage.getItem('products');
        if (savedProducts) appState.products = JSON.parse(savedProducts);
        const savedMeals = localStorage.getItem('meals');
        if (savedMeals) appState.meals = JSON.parse(savedMeals);
        const savedDiary = localStorage.getItem('diary');
        if (savedDiary) appState.diary = JSON.parse(savedDiary);
        const savedActivities = localStorage.getItem('activities');
        if (savedActivities) appState.activities = JSON.parse(savedActivities);
        const savedWeights = localStorage.getItem('weights');
        if (savedWeights) appState.weights = JSON.parse(savedWeights);
        const savedApiKey = localStorage.getItem('geminiApiKey');
        if (savedApiKey) appState.geminiApiKey = savedApiKey;
    }
}

async function saveData() {
    try {
        await docRef.set({
            targetKcal: appState.targetKcal,
            products: appState.products,
            meals: appState.meals,
            diary: appState.diary,
            activities: appState.activities,
            weights: appState.weights,
            geminiApiKey: appState.geminiApiKey || ''
        });
    } catch (error) {
        console.error("Błąd podczas zapisywania do Firebase:", error);
        localStorage.setItem('targetKcal', appState.targetKcal);
        localStorage.setItem('products', JSON.stringify(appState.products));
        localStorage.setItem('meals', JSON.stringify(appState.meals));
        localStorage.setItem('diary', JSON.stringify(appState.diary));
        localStorage.setItem('activities', JSON.stringify(appState.activities));
        localStorage.setItem('weights', JSON.stringify(appState.weights));
        localStorage.setItem('geminiApiKey', appState.geminiApiKey || '');
    }
}

// Nawigacja
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            switchView(targetId);
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(viewId).classList.add('active');
    const navBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if(navBtn) navBtn.classList.add('active');
    
    renderAll();
}

// Event Listenery
function setupEventListeners() {
    // Data (Dziennik)
    document.getElementById('prev-day').addEventListener('click', () => {
        appState.currentDate.setDate(appState.currentDate.getDate() - 1);
        renderDiaryView();
    });
    
    document.getElementById('next-day').addEventListener('click', () => {
        appState.currentDate.setDate(appState.currentDate.getDate() + 1);
        renderDiaryView();
    });

    // Ustawienia
    document.getElementById('form-settings').addEventListener('submit', (e) => {
        e.preventDefault();
        const target = document.getElementById('set-target-kcal').value;
        const geminiKey = document.getElementById('set-gemini-key').value.trim();
        
        appState.targetKcal = parseInt(target, 10);
        appState.geminiApiKey = geminiKey;
        
        saveData();
        alert('Zapisano ustawienia!');
        renderDiaryView();
    });

    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz usunąć WSZYSTKIE dane (historię, bazy, dania, wagę)? Tej operacji nie można cofnąć.')) {
            localStorage.clear();
            appState.products = [];
            appState.meals = [];
            appState.diary = {};
            appState.activities = {};
            appState.weights = {};
            saveData();
            renderAll();
            alert('Dane zostały usunięte.');
        }
    });

    // Eksport / Import
    document.getElementById('btn-export').addEventListener('click', () => {
        const dataToExport = {
            targetKcal: appState.targetKcal,
            products: appState.products,
            meals: appState.meals,
            diary: appState.diary,
            activities: appState.activities,
            weights: appState.weights
        };
        const dataStr = JSON.stringify(dataToExport);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'Historia_Licznik_Kalorii_' + formatDate(new Date()) + '.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    document.getElementById('input-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData.targetKcal) appState.targetKcal = importedData.targetKcal;
                if (importedData.products) appState.products = importedData.products;
                if (importedData.meals) appState.meals = importedData.meals;
                if (importedData.diary) appState.diary = importedData.diary;
                if (importedData.activities) appState.activities = importedData.activities;
                if (importedData.weights) appState.weights = importedData.weights;
                
                // Migracja wsteczna: jesli w imporcie nie bylo meals lub weights
                if(!appState.meals) appState.meals = [];
                if(!appState.weights) appState.weights = {};

                saveData();
                renderAll();
                alert('Dane zostały pomyślnie wczytane!');
                e.target.value = '';
            } catch (err) {
                alert('Błąd podczas wczytywania pliku. Upewnij się, że to poprawny plik.');
            }
        };
        reader.readAsText(file);
    });

    // Zapisywanie Wagi
    document.getElementById('form-add-weight').addEventListener('submit', (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('input-weight-kg').value);
        const dateKey = formatDate(appState.currentDate);
        
        appState.weights[dateKey] = weight;
        saveData();
        e.target.reset();
        renderProgressView();
        alert('Waga zapisana na ' + getDisplayDate(dateKey) + '!');
    });


    // Baza produktów
    document.getElementById('form-add-product').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('prod-name').value;
        const unit = document.getElementById('prod-unit').value || 'g'; 
        const kcal = parseFloat(document.getElementById('prod-kcal').value);
        const protein = parseFloat(document.getElementById('prod-protein').value) || 0;
        const carbs = parseFloat(document.getElementById('prod-carbs').value) || 0;
        const fat = parseFloat(document.getElementById('prod-fat').value) || 0;

        if (editingProductId) {
            const index = appState.products.findIndex(p => p.id === editingProductId);
            if (index !== -1) {
                appState.products[index] = {
                    id: editingProductId,
                    name, unit, kcal, protein, carbs, fat
                };
            }
            cancelEditProduct(); // resetuje formularz i stan
            alert('Produkt zaktualizowany!');
        } else {
            const newProduct = {
                id: generateId(),
                name, unit, kcal, protein, carbs, fat
            };
            appState.products.push(newProduct);
            e.target.reset();
            alert('Dodano produkt do bazy!');
        }

        appState.products.sort((a, b) => a.name.localeCompare(b.name));
        
        saveData();
        renderAll();
    });

    document.getElementById('search-product').addEventListener('input', (e) => {
        renderProductsList(e.target.value);
    });

    document.getElementById('search-meal').addEventListener('input', (e) => {
        renderMealsList(e.target.value);
    });

    // Dania (Meals) - Kreator
    document.getElementById('btn-add-ingredient').addEventListener('click', () => {
        const productName = document.getElementById('input-meal-ingredient').value;
        const weight = parseFloat(document.getElementById('input-meal-weight').value);

        const product = appState.products.find(p => p.name === productName);

        if (!product || isNaN(weight) || weight <= 0) {
            alert('Wpisz poprawną nazwę produktu z listy podpowiedzi i podaj wagę!');
            return;
        }

        mealBuilderIngredients.push({ id: generateId(), productId: product.id, weight });
        
        // Czyszczenie pol
        document.getElementById('input-meal-ingredient').value = '';
        document.getElementById('input-meal-weight').value = '';
        
        renderMealBuilder();
    });

    document.getElementById('btn-save-meal').addEventListener('click', () => {
        const mealName = document.getElementById('new-meal-name').value.trim();
        
        if (!mealName) {
            alert('Podaj nazwę dla tego dania!');
            return;
        }
        if (mealBuilderIngredients.length === 0) {
            alert('Dodaj przynajmniej jeden składnik do dania!');
            return;
        }

        if (editingMealId) {
            const index = appState.meals.findIndex(m => m.id === editingMealId);
            if (index !== -1) {
                appState.meals[index].name = mealName;
                appState.meals[index].ingredients = [...mealBuilderIngredients];
            }
            alert('Danie zaktualizowane!');
            cancelEditMeal(); // resetuje stany i renderuje
        } else {
            const newMeal = {
                id: generateId(),
                name: mealName,
                ingredients: [...mealBuilderIngredients]
            };
            appState.meals.push(newMeal);
            appState.meals.sort((a, b) => a.name.localeCompare(b.name));
            alert('Zapisano nowe danie!');
            mealBuilderIngredients = [];
            document.getElementById('new-meal-name').value = '';
        }

        saveData();
        renderAll();
    });

    // Dziennik - dodawanie pojedynczego produktu
    document.getElementById('form-add-entry').addEventListener('submit', (e) => {
        e.preventDefault();
        const productName = document.getElementById('input-product-diary').value;
        const weight = parseFloat(document.getElementById('input-weight').value);

        const product = appState.products.find(p => p.name === productName);

        if (!product) {
            alert('Wybrany produkt nie istnieje w bazie! Użyj podpowiedzi.');
            return;
        }

        addEntryToDiary(product.id, weight);
        e.target.reset();
    });

    // Dziennik - dodawanie gotowego dania
    document.getElementById('form-add-meal-to-diary').addEventListener('submit', (e) => {
        e.preventDefault();
        const mealName = document.getElementById('input-meal-diary').value;
        
        const meal = appState.meals.find(m => m.name === mealName);
        if (!meal) {
            alert('Wybrane danie nie istnieje! Użyj podpowiedzi.');
            return;
        }

        // Rozpakowywanie dania na pojedyncze wpisy w dzienniku
        meal.ingredients.forEach(ing => {
            addEntryToDiary(ing.productId, ing.weight, true); // true = skip render for a moment
        });
        saveData();
        renderDiaryView();
        alert(`Dodano danie: ${meal.name} do dziennika.`);
        
        e.target.reset();
    });

    // Dziennik - dodawanie aktywności
    document.getElementById('form-add-activity').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('input-activity-name').value;
        const kcal = parseFloat(document.getElementById('input-activity-kcal').value);

        const dateKey = formatDate(appState.currentDate);
        if (!appState.activities[dateKey]) {
            appState.activities[dateKey] = [];
        }

        appState.activities[dateKey].push({
            id: generateId(),
            name,
            kcal
        });

        saveData();
        e.target.reset();
        renderDiaryView();
    });
}

// Funkcja pomocnicza dodająca wpis do dziennika
function addEntryToDiary(productId, weight, skipRender = false) {
    const dateKey = formatDate(appState.currentDate);
    if (!appState.diary[dateKey]) {
        appState.diary[dateKey] = [];
    }

    appState.diary[dateKey].push({
        id: generateId(),
        productId,
        weight
    });

    if (!skipRender) {
        saveData();
        renderDiaryView();
    }
}

// Renderowanie
function renderAll() {
    renderDiaryView();
    renderProductsView();
    renderMealsView();
    renderProgressView();
    renderSettingsView();
    updateAllSelects();
}

function renderSettingsView() {
    document.getElementById('set-target-kcal').value = appState.targetKcal;
    document.getElementById('set-gemini-key').value = appState.geminiApiKey || '';
}

function renderProductsView() {
    renderProductsList();
}

function renderProductsList(filter = '') {
    const list = document.getElementById('products-list');
    list.innerHTML = '';

    const filtered = appState.products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
        list.innerHTML = '<li>Brak produktów. Dodaj coś nowego!</li>';
        return;
    }

    filtered.forEach(p => {
        const unitText = p.unit === 'szt' ? '1 sztuka' : '100g';
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-title">${p.name}</span>
                <span class="list-item-macros">${unitText}: ${p.kcal} kcal | B: ${p.protein}g | W: ${p.carbs}g | T: ${p.fat}g</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-edit" onclick="editProduct('${p.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteProduct('${p.id}')">✖</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function updateAllSelects() {
    const listProducts = document.getElementById('datalist-products');
    if(listProducts) {
        listProducts.innerHTML = '';
        appState.products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            listProducts.appendChild(opt);
        });
    }

    const listMeals = document.getElementById('datalist-meals');
    if(listMeals) {
        listMeals.innerHTML = '';
        appState.meals.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            listMeals.appendChild(opt);
        });
    }
}

// Funkcje globalne usuwania
window.deleteProduct = function(id) {
    if (confirm('Usunąć produkt z bazy? UWAGA: Wpłynie to na dania i historyczne wpisy zawierające ten produkt!')) {
        appState.products = appState.products.filter(p => p.id !== id);
        saveData();
        renderProductsView();
        updateAllSelects();
        renderMealsList(); // Moze byc uszkodzone danie
        renderDiaryView();
    }
};

window.deleteEntry = function(id) {
    const dateKey = formatDate(appState.currentDate);
    if (appState.diary[dateKey]) {
        appState.diary[dateKey] = appState.diary[dateKey].filter(e => e.id !== id);
        saveData();
        renderDiaryView();
    }
};

window.deleteActivity = function(id) {
    const dateKey = formatDate(appState.currentDate);
    if (appState.activities[dateKey]) {
        appState.activities[dateKey] = appState.activities[dateKey].filter(a => a.id !== id);
        saveData();
        renderDiaryView();
    }
};

window.removeIngredientFromBuilder = function(id) {
    mealBuilderIngredients = mealBuilderIngredients.filter(i => i.id !== id);
    renderMealBuilder();
};

window.deleteMeal = function(id) {
    if (confirm('Usunąć to danie z zapisanych zestawów?')) {
        appState.meals = appState.meals.filter(m => m.id !== id);
        saveData();
        renderMealsList();
        updateAllSelects();
    }
};

// --- WIDOK DAŃ (MEALS) ---
function renderMealsView() {
    renderMealBuilder();
    renderMealsList();
}

function calculateMacrosForIngredients(ingredientsArray) {
    let totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    
    ingredientsArray.forEach(ing => {
        const product = appState.products.find(p => p.id === ing.productId);
        if (product) {
            const multi = product.unit === 'szt' ? ing.weight : ing.weight / 100;
            totals.kcal += Math.round(product.kcal * multi);
            totals.protein += product.protein * multi;
            totals.carbs += product.carbs * multi;
            totals.fat += product.fat * multi;
        }
    });

    return totals;
}

function renderMealBuilder() {
    const list = document.getElementById('current-meal-ingredients');
    list.innerHTML = '';
    
    if (mealBuilderIngredients.length === 0) {
        list.innerHTML = '<li style="padding: 10px; font-size: 0.9rem; color: #888;">Brak składników.</li>';
    } else {
        mealBuilderIngredients.forEach(ing => {
            const product = appState.products.find(p => p.id === ing.productId);
            const name = product ? product.name : "Nieznany produkt";
            const unitLabel = product && product.unit === 'szt' ? 'szt' : 'g';
            const li = document.createElement('li');
            li.style.padding = '5px 10px';
            li.innerHTML = `
                <div class="list-item-info">
                    <span class="list-item-title" style="font-size: 0.9rem;">${name} - ${ing.weight}${unitLabel}</span>
                </div>
                <button class="btn-delete" style="font-size: 1rem; padding: 2px;" onclick="removeIngredientFromBuilder('${ing.id}')">✖</button>
            `;
            list.appendChild(li);
        });
    }

    const totals = calculateMacrosForIngredients(mealBuilderIngredients);
    
    document.getElementById('new-meal-kcal').textContent = totals.kcal;
    document.getElementById('new-meal-protein').textContent = totals.protein.toFixed(1);
    document.getElementById('new-meal-carbs').textContent = totals.carbs.toFixed(1);
    document.getElementById('new-meal-fat').textContent = totals.fat.toFixed(1);
}

function renderMealsList(filter = '') {
    const list = document.getElementById('meals-list');
    list.innerHTML = '';

    const filtered = appState.meals.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
        list.innerHTML = '<li>Brak dań spełniających kryteria.</li>';
    }

    filtered.forEach(meal => {
        const totals = calculateMacrosForIngredients(meal.ingredients);
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-title" style="color: var(--primary-color);">${meal.name}</span>
                <span class="list-item-macros">Suma: ${totals.kcal} kcal | B: ${totals.protein.toFixed(1)}g | W: ${totals.carbs.toFixed(1)}g | T: ${totals.fat.toFixed(1)}g</span>
                <span class="list-item-macros" style="font-size: 0.75rem; margin-top: 5px;">Składniki: ${meal.ingredients.length}</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-edit" onclick="editMeal('${meal.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteMeal('${meal.id}')">✖</button>
            </div>
        `;
        list.appendChild(li);
    });
}


// --- WIDOK DZIENNIKA ---
function renderDiaryView() {
    const dateKey = formatDate(appState.currentDate);
    document.getElementById('current-date').textContent = getDisplayDate(dateKey);

    // --- POSIŁKI ---
    const entries = appState.diary[dateKey] || [];
    const list = document.getElementById('diary-list');
    list.innerHTML = '';

    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    if (entries.length === 0) {
        list.innerHTML = '<li>Brak wpisów jedzenia.</li>';
    }

    entries.forEach(entry => {
        const product = appState.products.find(p => p.id === entry.productId);
        if (!product) return; 

        const multiplier = product.unit === 'szt' ? entry.weight : entry.weight / 100;
        const kcal = Math.round(product.kcal * multiplier);
        const protein = (product.protein * multiplier).toFixed(1);
        const carbs = (product.carbs * multiplier).toFixed(1);
        const fat = (product.fat * multiplier).toFixed(1);

        totalKcal += kcal;
        totalProtein += parseFloat(protein);
        totalCarbs += parseFloat(carbs);
        totalFat += parseFloat(fat);

        const unitLabel = product.unit === 'szt' ? 'szt' : 'g';
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-title">${product.name} - ${entry.weight}${unitLabel}</span>
                <span class="list-item-macros">${kcal} kcal | B: ${protein}g | W: ${carbs}g | T: ${fat}g</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-edit" onclick="editEntry('${entry.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteEntry('${entry.id}')">✖</button>
            </div>
        `;
        list.appendChild(li);
    });

    // --- AKTYWNOŚĆ ---
    const activities = appState.activities[dateKey] || [];
    const actList = document.getElementById('activity-list');
    actList.innerHTML = '';
    
    let activityTotalKcal = 0;

    if (activities.length === 0) {
        actList.innerHTML = '<li>Brak zarejestrowanej aktywności.</li>';
    }

    activities.forEach(act => {
        activityTotalKcal += act.kcal;
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-title">${act.name}</span>
                <span class="list-item-macros" style="color: var(--secondary-color); font-weight: bold;">- ${act.kcal} kcal</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-edit" onclick="editActivity('${act.id}')">✏️</button>
                <button class="btn-delete" onclick="deleteActivity('${act.id}')">✖</button>
            </div>
        `;
        actList.appendChild(li);
    });

    // --- PODSUMOWANIE (Dynamiczny Cel Kaloryczny) ---
    const dynamicTargetKcal = appState.targetKcal + activityTotalKcal;

    document.getElementById('consumed-kcal').textContent = totalKcal;
    document.getElementById('target-kcal').textContent = dynamicTargetKcal;
    
    document.getElementById('ppm-display').textContent = appState.targetKcal;
    document.getElementById('activity-kcal-display').textContent = activityTotalKcal;
    
    document.getElementById('consumed-protein').textContent = Math.round(totalProtein);
    document.getElementById('consumed-carbs').textContent = Math.round(totalCarbs);
    document.getElementById('consumed-fat').textContent = Math.round(totalFat);

    let kcalPercent = (totalKcal / dynamicTargetKcal) * 100;
    if (kcalPercent > 100) kcalPercent = 100;
    if (isNaN(kcalPercent)) kcalPercent = 0;
    
    const progressKcal = document.getElementById('progress-kcal');
    progressKcal.style.width = `${kcalPercent}%`;
    
    if (totalKcal > dynamicTargetKcal) {
        progressKcal.style.backgroundColor = 'var(--error-color)';
    } else {
        progressKcal.style.backgroundColor = 'var(--primary-color)';
    }

    // Makra (obliczane na podstawie dynamicznego celu, np. białko 20%, węgle 50%, tłuszcz 30%)
    const targetProtein = (dynamicTargetKcal * 0.20) / 4; 
    const targetCarbs = (dynamicTargetKcal * 0.50) / 4;
    const targetFat = (dynamicTargetKcal * 0.30) / 9;

    let proteinPercent = targetProtein > 0 ? (totalProtein / targetProtein) * 100 : 0;
    let carbsPercent = targetCarbs > 0 ? (totalCarbs / targetCarbs) * 100 : 0;
    let fatPercent = targetFat > 0 ? (totalFat / targetFat) * 100 : 0;

    document.getElementById('progress-protein').style.width = `${Math.min(proteinPercent, 100)}%`;
    document.getElementById('progress-carbs').style.width = `${Math.min(carbsPercent, 100)}%`;
    document.getElementById('progress-fat').style.width = `${Math.min(fatPercent, 100)}%`;
}

// Uruchomienie aplikacji

window.deleteWeight = function(dateKey) {
    if (confirm('Usunąć wpis wagi z tego dnia?')) {
        delete appState.weights[dateKey];
        saveData();
        renderProgressView();
    }
};

function renderProgressView() {
    // Lista wagi
    const list = document.getElementById('weights-list');
    list.innerHTML = '';
    
    // Sortuj klucze dat od najnowszej
    const sortedDates = Object.keys(appState.weights).sort((a, b) => new Date(b) - new Date(a));
    
    if (sortedDates.length === 0) {
        list.innerHTML = '<li>Brak wpisów wagi. Dodaj pierwszy!</li>';
    } else {
        sortedDates.forEach(date => {
            const weight = appState.weights[date];
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="list-item-info">
                    <span class="list-item-title">${getDisplayDate(date)}</span>
                    <span class="list-item-macros" style="font-size: 1.1rem; color: var(--primary-color); font-weight: bold;">${weight} kg</span>
                </div>
                <button class="btn-delete" onclick="deleteWeight('${date}')">✖</button>
            `;
            list.appendChild(li);
        });
    }

    // Podsumowanie ostatnich 7 dni (wliczając dzisiaj)
    let totalIn = 0;
    let totalOut = 0;
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(appState.currentDate);
        d.setDate(d.getDate() - i);
        const dateKey = formatDate(d);
        
        // Jedzenie
        const entries = appState.diary[dateKey] || [];
        entries.forEach(entry => {
            const product = appState.products.find(p => p.id === entry.productId);
            if (product) {
                const multiplier = product.unit === 'szt' ? entry.weight : entry.weight / 100;
                totalIn += product.kcal * multiplier;
            }
        });
        
        // Aktywność
        const activities = appState.activities[dateKey] || [];
        activities.forEach(act => {
            totalOut += act.kcal;
        });
    }
    
    const avgIn = Math.round(totalIn / 7);
    const avgOut = Math.round(totalOut / 7);
    const ppm = appState.targetKcal;
    
    // Średni bilans: to co zjedliśmy MINUS (PPM + średnio spalone z aktywności)
    // Zjedliśmy 2500, PPM=2000, Spalone=300. Bilans: 2500 - (2000+300) = +200
    const avgBalance = avgIn - (ppm + avgOut);
    
    document.getElementById('summary-avg-in').textContent = avgIn;
    document.getElementById('summary-avg-out').textContent = avgOut;
    
    const balanceEl = document.getElementById('summary-balance');
    balanceEl.textContent = avgBalance > 0 ? `+${avgBalance}` : avgBalance;
    
    if (avgBalance > 0) {
        balanceEl.style.color = 'var(--error-color)'; // Na plusie = tyjemy (przyjęliśmy więcej)
    } else if (avgBalance < 0) {
        balanceEl.style.color = 'var(--secondary-color)'; // Na minusie = chudniemy
    } else {
        balanceEl.style.color = 'var(--text-color)';
    }
}

window.editEntry = function(id) {
    const dateKey = formatDate(appState.currentDate);
    if (!appState.diary[dateKey]) return;
    
    const entryIndex = appState.diary[dateKey].findIndex(e => e.id === id);
    if (entryIndex === -1) return;
    
    const entry = appState.diary[dateKey][entryIndex];
    const product = appState.products.find(p => p.id === entry.productId);
    if (!product) return;
    
    const unitLabel = product.unit === 'szt' ? 'szt' : 'g';
    const newWeight = prompt(`Zmień ilość dla: ${product.name} (${unitLabel})`, entry.weight);
    
    if (newWeight !== null) {
        // Zmień przecinek na kropkę, żeby parseFloat nie wariował dla polskiego formatu
        const normalized = newWeight.replace(',', '.');
        const parsed = parseFloat(normalized);
        if (!isNaN(parsed) && parsed > 0) {
            appState.diary[dateKey][entryIndex].weight = parsed;
            saveData();
            renderAll();
        } else {
            alert('Podano nieprawidłową wartość. Wpisz liczbę większą od zera.');
        }
    }
};

window.editActivity = function(id) {
    const dateKey = formatDate(appState.currentDate);
    if (!appState.activities[dateKey]) return;
    
    const actIndex = appState.activities[dateKey].findIndex(e => e.id === id);
    if (actIndex === -1) return;
    
    const act = appState.activities[dateKey][actIndex];
    
    const newKcal = prompt(`Zmień spalone kalorie dla: ${act.name}`, act.kcal);
    
    if (newKcal !== null) {
        const normalized = newKcal.replace(',', '.');
        const parsed = parseFloat(normalized);
        if (!isNaN(parsed) && parsed >= 0) {
            appState.activities[dateKey][actIndex].kcal = parsed;
            saveData();
            renderAll();
        } else {
            alert('Podano nieprawidłową wartość.');
        }
    }
};

// -- Stan edycji --
let editingProductId = null;
let editingMealId = null;

// Edycja Bazy Produktów
window.editProduct = function(id) {
    const p = appState.products.find(x => x.id === id);
    if (!p) return;
    
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-unit').value = p.unit || 'g';
    document.getElementById('prod-kcal').value = p.kcal;
    document.getElementById('prod-protein').value = p.protein;
    document.getElementById('prod-carbs').value = p.carbs;
    document.getElementById('prod-fat').value = p.fat;
    
    editingProductId = p.id;
    
    // Zmień przycisk
    const formBtn = document.querySelector('#form-add-product button');
    formBtn.textContent = 'Zapisz zmiany';
    formBtn.style.backgroundColor = '#bb86fc'; // wyróżnienie
    formBtn.style.color = '#000';
    
    // Dodaj przycisk anulowania jeśli nie istnieje
    if (!document.getElementById('btn-cancel-edit-prod')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'btn-cancel-edit-prod';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.textContent = 'Anuluj';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.onclick = cancelEditProduct;
        document.getElementById('form-add-product').appendChild(cancelBtn);
    }
    
    document.getElementById('prod-name').scrollIntoView({behavior: 'smooth'});
};

function cancelEditProduct() {
    editingProductId = null;
    document.getElementById('form-add-product').reset();
    
    const formBtn = document.querySelector('#form-add-product button[type="submit"]');
    formBtn.textContent = 'Dodaj produkt do bazy';
    formBtn.style.backgroundColor = '';
    formBtn.style.color = '';
    
    const cancelBtn = document.getElementById('btn-cancel-edit-prod');
    if (cancelBtn) cancelBtn.remove();
}

// Edycja Dań
window.editMeal = function(id) {
    const m = appState.meals.find(x => x.id === id);
    if (!m) return;
    
    document.getElementById('new-meal-name').value = m.name;
    // Kopia głęboka składników, żeby nie mutować oryginału w trakcie edycji
    mealBuilderIngredients = JSON.parse(JSON.stringify(m.ingredients));
    editingMealId = m.id;
    
    const formBtn = document.getElementById('btn-save-meal');
    formBtn.textContent = 'Zapisz zmiany w daniu';
    formBtn.style.backgroundColor = '#bb86fc';
    formBtn.style.color = '#000';
    
    if (!document.getElementById('btn-cancel-edit-meal')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'btn-cancel-edit-meal';
        cancelBtn.className = 'btn-secondary';
        cancelBtn.textContent = 'Anuluj';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.onclick = cancelEditMeal;
        document.getElementById('new-meal-name').parentElement.appendChild(cancelBtn);
    }
    
    renderMealBuilder();
    document.getElementById('new-meal-name').scrollIntoView({behavior: 'smooth'});
};

function cancelEditMeal() {
    editingMealId = null;
    mealBuilderIngredients = [];
    document.getElementById('new-meal-name').value = '';
    
    const formBtn = document.getElementById('btn-save-meal');
    formBtn.textContent = 'Zapisz Danie';
    formBtn.style.backgroundColor = '';
    formBtn.style.color = '';
    
    const cancelBtn = document.getElementById('btn-cancel-edit-meal');
    if (cancelBtn) cancelBtn.remove();
    
    renderMealBuilder();
}

// Auth Listeners
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch(err) {
        alert('Błąd logowania. Sprawdź e-mail i hasło.');
    }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if(!email || !pass || pass.length < 6) {
        alert('Podaj e-mail i hasło (min. 6 znaków), a następnie kliknij "Załóż nowe konto"');
        return;
    }
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        alert('Konto utworzone! Następuje logowanie...');
    } catch(err) {
        alert('Błąd rejestracji: ' + err.message);
    }
});

if(document.getElementById('btn-logout')) {
    document.getElementById('btn-logout').addEventListener('click', () => {
        auth.signOut();
    });
}

// AI Asystent Logic
document.getElementById('form-ai-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = appState.geminiApiKey;
    if (!apiKey) {
        alert("Brak klucza API Gemini! Przejdź do zakładki 'Opcje' i dodaj swój klucz.");
        return;
    }
    
    const userInput = document.getElementById('ai-input').value;
    if (!userInput.trim()) return;

    const btn = document.getElementById('btn-ai-submit');
    const originalText = btn.textContent;
    btn.textContent = "⏳ Analizuję (to potrwa kilka sekund)...";
    btn.disabled = true;

    const systemInstruction = `Jesteś asystentem dietetycznym w polskiej aplikacji liczącej kalorie. Użytkownik podaje Ci to co zjadł. 
Twoim zadaniem jest zidentyfikować produkty, oszacować ich porcje (w gramach lub sztukach) i podać makroskładniki.
Zwróć dokładnie i WYŁĄCZNIE tablicę JSON, gdzie każdy element to obiekt:
{
  "name": "nazwa produktu z dużej litery (np. Jajko sadzone, Chleb tostowy)",
  "unit": "g" lub "szt",
  "weight": liczba_całkowita_oznaczająca_zjedzoną_ilość (np. 150 jeśli zjadł 150g, 2 jeśli zjadł 2 sztuki),
  "kcal": liczba_całkowita_kalorii (wartość na 100g dla unit="g" lub na 1 sztukę dla unit="szt"),
  "protein": białko_w_gramach (na 100g dla g lub na 1 szt dla szt),
  "carbs": wegle_w_gramach (na 100g dla g lub na 1 szt dla szt),
  "fat": tluszcz_w_gramach (na 100g dla g lub na 1 szt dla szt)
}
Oszacuj to najlepiej jak potrafisz. Zwróć sam JSON, bez oznaczników Markdown (\`\`\`json). Sam czysty JSON!`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: "user", parts: [{ text: userInput }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Błąd HTTP: ${response.status} - ${errorData.error?.message || 'Brak szczegółów'}`);
        }

        const jsonResp = await response.json();
        const rawText = jsonResp.candidates[0].content.parts[0].text;
        
        let parsed = [];
        try {
            parsed = JSON.parse(rawText);
        } catch(e) {
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleaned);
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
            let addedNames = [];
            parsed.forEach(item => {
                let product = appState.products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
                if (!product) {
                    product = {
                        id: generateId(),
                        name: item.name,
                        unit: item.unit === 'szt' ? 'szt' : 'g',
                        kcal: parseFloat(item.kcal) || 0,
                        protein: parseFloat(item.protein) || 0,
                        carbs: parseFloat(item.carbs) || 0,
                        fat: parseFloat(item.fat) || 0
                    };
                    appState.products.push(product);
                }
                addEntryToDiary(product.id, parseFloat(item.weight) || (item.unit === 'szt' ? 1 : 100));
                addedNames.push(`${item.name} (${item.weight}${item.unit === 'szt' ? 'szt' : 'g'})`);
            });
            appState.products.sort((a, b) => a.name.localeCompare(b.name));
            document.getElementById('ai-input').value = '';
            alert("Sztuczna Inteligencja dodała:\n\n" + addedNames.join("\n"));
        } else {
            alert("AI nie znalazło tu żadnego jedzenia albo nie zrozumiało prośby.");
        }
    } catch (err) {
        console.error("Gemini Error:", err);
        alert("Błąd AI: " + err.message + "\n\nUpewnij się, że po wklejeniu klucza kliknąłeś 'Zapisz ustawienia'.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});
