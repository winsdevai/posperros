// ==========================================
// SISTEMA POS - SCRIPT.JS (ACTUALIZADO)
// ==========================================

// --- BASE DE DATOS LOCAL ---
const defaultDB = {
    config: {
        pin: "1234",
        ticketCounter: 1,
        rateUsd: 600,
        rateBinance: 600,
        initialCapitalBs: 0,
        initialCapitalUsd: 0
    },
    categories: [
        { id: 1, name: "Hamburguesas", icon: "🍔" },
        { id: 2, name: "Perros Calientes", icon: "🌭" },
        { id: 3, name: "Bebidas", icon: "🥤" }
    ],
    products: [
        {
            id: 1, categoryId: 1, name: "Hamburguesa Clásica",
            priceUsd: 1.50, stock: 50,
            image: "🍔", ingredients: ["Pan", "Carne", "Lechuga", "Tomate", "Queso"]
        },
        {
            id: 2, categoryId: 3, name: "Pepsi 500ml",
            priceUsd: 0.80, stock: 100,
            image: "🥤", ingredients: []
        }
    ],
    cart: [],
    sales: [],
    history: [],
    balance: {
        cashBs: 0,
        cashUsd: 0,
        bank: 0,
        usdt: 0
    },
    currentShift: {
        isOpen: false,
        openingAmountBs: 0,
        openingAmountUsd: 0,
        payments: { efectivo: 0, pago_movil: 0, punto: 0, divisa: 0 },
        // SEPARAMOS EL CAMBIO EN 3 VARIABLES
        changeGivenBs: 0,
        changeGivenUsd: 0,
        changeGivenDigital: 0,
        salesCount: 0,
        totalSoldBs: 0
    }

};

let db = JSON.parse(localStorage.getItem('pos_db')) || defaultDB;
let lowStockMode = false;

function toggleLowStock() {
    lowStockMode = !lowStockMode; // Cambiar estado (true/false)
    navTo('productos'); // Refrescar la lista
}

function sanitizeDB() {
    let needsSave = false;
    // Comprobar tasas
    if (!db.config.initialCapitalBs) db.config.initialCapitalBs = 0;
    if (!db.config.initialCapitalUsd) db.config.initialCapitalUsd = 0;
    if (!db.config.rateUsd || db.config.rateUsd === 0) { db.config.rateUsd = 600; needsSave = true; }
    if (!db.config.rateBinance) { db.config.rateBinance = 600; needsSave = true; }
    if (!db.sales) { db.sales = []; needsSave = true; }
    if (!db.history) { db.history = []; needsSave = true; }

    if (!db.currentShift) {
        db.currentShift = {
            isOpen: false,
            openingAmountBs: 0,
            openingAmountUsd: 0,
            payments: { efectivo: 0, pago_movil: 0, punto: 0, divisa: 0 },
            changeGivenBs: 0,
            changeGivenUsd: 0,
            changeGivenDigital: 0,
            salesCount: 0,
            totalSoldBs: 0
        };
        needsSave = true;
    }
    // Migración para usuarios que tengan la version vieja
    if (db.currentShift.totalChangeBs !== undefined && !db.currentShift.changeGivenBs) {
        db.currentShift.changeGivenBs = db.currentShift.totalChangeBs;
        db.currentShift.totalChangeBs = 0; // Limpiar variable vieja
        needsSave = true;
    }

    if (needsSave) saveDB();

    if (!db.balance) {
        db.balance = { cashBs: 0, cashUsd: 0, bank: 0, usdt: 0 };
        needsSave = true;
    }
}

function saveDB() {
    localStorage.setItem('pos_db', JSON.stringify(db));
}


// --- ELEMENTOS DOM ---
const posView = document.getElementById('pos-view');
const adminView = document.getElementById('admin-view');
const contentArea = document.getElementById('admin-content-area');
const logoTrigger = document.getElementById('logo-trigger');
const cartBadge = document.getElementById('cart-count');
const sidebar = document.getElementById('sidebar');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    sanitizeDB();
    updateCartBadge();
    renderCategories();
});

// ==========================================
// LÓGICA POS (Navegación y Renderizado)
// ==========================================

function renderCategories() {
    const catContainer = document.getElementById('category-container');
    const prodContainer = document.getElementById('product-container');
    const backBtn = document.getElementById('pos-back-btn');

    // Mostrar categorías, ocultar productos y botón volver
    catContainer.classList.remove('hidden');
    prodContainer.classList.add('hidden');
    backBtn.style.display = 'none';

    catContainer.innerHTML = '';

    db.categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'product-card';
        // Estilo más grande para categoría
        card.style.minHeight = '120px';
        card.innerHTML = `
            <div class="product-img-placeholder" style="height: 80px; font-size: 2.5rem;">${cat.icon}</div>
            <div class="product-info">
                <div class="font-bold text-lg">${cat.name}</div>
            </div>
        `;
        card.onclick = () => openCategory(cat.id);
        catContainer.appendChild(card);
    });
}

// 2. Abrir Categoría (Mostrar Productos)
function openCategory(catId) {
    const catContainer = document.getElementById('category-container');
    const prodContainer = document.getElementById('product-container');
    const backBtn = document.getElementById('pos-back-btn');

    // Ocultar categorías, mostrar productos y botón volver
    catContainer.classList.add('hidden');
    prodContainer.classList.remove('hidden');
    backBtn.style.display = 'block';

    const filtered = db.products.filter(p => p.categoryId === catId);
    prodContainer.innerHTML = '';

    if (filtered.length === 0) {
        prodContainer.innerHTML = '<p class="text-center w-full text-gray-500 mt-4">No hay productos en esta categoría.</p>';
        return;
    }

    filtered.forEach(p => {
        const priceBs = (p.priceUsd * db.config.rateUsd).toFixed(0);

        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openProductModal(p.id);

        // Estado visual si no hay stock
        const stockClass = p.stock <= 0 ? 'opacity-50 grayscale' : '';

        card.innerHTML = `
            <div class="product-img-placeholder ${stockClass}">${p.image || '🍽️'}</div>
            <div class="product-info">
                <div class="font-bold text-sm">${p.name}</div>
                <div class="price-tag">$${p.priceUsd}</div>
                <div class="text-xs text-gray-400">${priceBs} Bs</div>
            </div>
        `;
        prodContainer.appendChild(card);
    });
}

// ==========================================
// MODAL PRODUCTO (DETALLE Y CANTIDAD)
// ==========================================
let currentProduct = null;
let currentIngredients = {};
let currentQuantity = 1;

function openProductModal(productId) {
    currentProduct = db.products.find(p => p.id === productId);
    if (!currentProduct) return;

    if (currentProduct.stock <= 0) {
        showToast("Producto agotado");
        return;
    }

    // Resetear estado
    currentQuantity = 1;
    currentIngredients = {};

    if (currentProduct.ingredients && currentProduct.ingredients.length > 0) {
        currentProduct.ingredients.forEach(ing => currentIngredients[ing] = true);
    }

    updateModalProductUI();
    openModal('modal-product');
}

function updateModalProductUI() {
    document.getElementById('modal-prod-name').innerText = currentProduct.name;

    const priceBs = (currentProduct.priceUsd * db.config.rateUsd).toFixed(2);
    document.getElementById('modal-prod-price').innerText = `$${currentProduct.priceUsd} (~ ${priceBs} Bs)`;

    document.getElementById('modal-prod-stock').innerText = `Stock disponible: ${currentProduct.stock}`;
    document.getElementById('modal-qty-val').innerText = currentQuantity;

    const list = document.getElementById('modal-ing-list');
    list.innerHTML = '';

    if (currentProduct.ingredients && currentProduct.ingredients.length > 0) {
        currentProduct.ingredients.forEach(ing => {
            const chip = document.createElement('div');
            chip.className = `ing-chip ${currentIngredients[ing] ? 'active' : 'disabled'}`;
            chip.innerText = ing;
            chip.onclick = () => toggleIngredient(ing);
            list.appendChild(chip);
        });
    } else {
        list.innerHTML = '<p class="text-sm text-gray-500">Este producto no tiene modificaciones.</p>';
    }
}

function changeQty(delta) {
    const newQty = currentQuantity + delta;
    if (newQty >= 1 && newQty <= currentProduct.stock) {
        currentQuantity = newQty;
        document.getElementById('modal-qty-val').innerText = currentQuantity;
    } else if (newQty > currentProduct.stock) {
        showToast("No hay suficiente stock");
    }
}

function toggleIngredient(ing) {
    currentIngredients[ing] = !currentIngredients[ing];
    updateModalProductUI();
}

function addToCart(stayInModal) {
    const disabledIngs = Object.keys(currentIngredients).filter(k => !currentIngredients[k]);
    const note = disabledIngs.length > 0 ? `Sin: ${disabledIngs.join(', ')}` : '';

    // Descontar Stock (Lógica de venta)
    if (currentProduct.stock < currentQuantity) {
        showToast("Stock insuficiente");
        return;
    }

    // Encontrar índice del producto en DB para actualizar stock real
    const prodIndex = db.products.findIndex(p => p.id === currentProduct.id);
    if (prodIndex !== -1) {
        db.products[prodIndex].stock -= currentQuantity;
    }

    const item = {
        id: Date.now(),
        productId: currentProduct.id,
        name: currentProduct.name,
        priceUsd: currentProduct.priceUsd,
        priceBs: currentProduct.priceUsd * db.config.rateUsd, // Guardar precio al momento de la compra
        qty: currentQuantity,
        note: note
    };

    db.cart.push(item);
    saveDB();
    updateCartBadge();
    showToast(`${currentQuantity} Agregado(s)`);

    if (!stayInModal) {
        closeModal('modal-product');
        // Refrescar vista actual por si cambió el stock
        openCategory(currentProduct.categoryId);
    } else {
        // Reset para el siguiente item (Agregar y Mantener)
        currentQuantity = 1;
        currentIngredients = {};
        if (currentProduct.ingredients) {
            currentProduct.ingredients.forEach(ing => currentIngredients[ing] = true);
        }
        updateModalProductUI();
    }
}

function updateCartBadge() {
    cartBadge.innerText = db.cart.reduce((acc, item) => acc + item.qty, 0);
}

function abrirCarrito() {
    if (db.cart.length === 0) {
        showToast("El carrito está vacío");
        return;
    }

    renderCartItems();

    // Limpiar los 4 inputs fijos
    document.getElementById('pay-efectivo').value = '';
    document.getElementById('pay-pm').value = '';
    document.getElementById('pay-punto').value = '';
    document.getElementById('pay-divisa').value = '';

    document.getElementById('change-container').classList.add('hidden');
    openModal('modal-cart');
    calculateTotals();
}

// ==========================================
// SEGURIDAD Y LOGIN (Mismo que antes)
// ==========================================
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); openAdminLogin(); } });
let pressTimer;
logoTrigger.addEventListener('mousedown', () => pressTimer = setTimeout(openAdminLogin, 800));
logoTrigger.addEventListener('touchstart', () => pressTimer = setTimeout(openAdminLogin, 800));
['mouseup', 'mouseleave', 'touchend'].forEach(ev => logoTrigger.addEventListener(ev, () => clearTimeout(pressTimer)));

function openAdminLogin() {
    document.getElementById('admin-pin').value = '';
    document.getElementById('login-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-pin').focus(), 100);
}
document.getElementById('close-login').onclick = () => document.getElementById('login-modal').classList.add('hidden');
document.getElementById('admin-pin').addEventListener('keypress', (e) => { if (e.key === 'Enter') verifyPin() });
document.getElementById('btn-verify-pin').onclick = verifyPin;

function verifyPin() {
    const pinInput = document.getElementById('admin-pin').value;
    if (pinInput === db.config.pin) {
        document.getElementById('login-modal').classList.add('hidden');
        enterAdmin();
    } else {
        showToast("Clave incorrecta");
    }
}

// ==========================================
// PANEL ADMIN
// ==========================================
function enterAdmin() {
    posView.classList.add('hidden');
    adminView.classList.remove('hidden');
    navTo('inicio');
}
function exitAdmin() {
    adminView.classList.add('hidden');
    posView.classList.remove('hidden');
    renderCategories();
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// --- FUNCION AUXILIAR PARA BUSCADOR (NO BORRAR PÁGINA) ---
function renderProductTable() {
    const container = document.getElementById('prod-table-body'); // ID nuevo para tbody
    if (!container) return; // Si no estamos en la sección, salir

    const currentSearch = document.getElementById('prod-search-input')?.value.toLowerCase() || '';

    let filteredProducts = db.products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(currentSearch);
        const matchesStock = lowStockMode ? (p.stock < 11) : true;
        return matchesSearch && matchesStock;
    });

    let rows = filteredProducts.map(p => {
        const priceBs = (p.priceUsd * db.config.rateUsd).toFixed(2);
        const stockStyle = p.stock < 11 ? 'color: var(--danger); font-weight:bold;' : '';

        return `
            <tr>
                <td>${p.name}</td>
                <td>$${p.priceUsd}</td>
                <td>${priceBs} Bs</td>
                <td style="${stockStyle}">${p.stock}</td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editProduct(${p.id})">Editar</button>
                    <button class="btn-sm btn-delete" onclick="deleteProduct(${p.id})">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = rows.length > 0 ? rows : '<tr><td colspan="5" class="text-center p-4">No se encontraron productos</td></tr>';
}

function navTo(section) {
    // --- FIX BUSCADOR (FOCUS) ---
    // Guardar el valor del buscador antes de borrar la pantalla
    let savedSearchValue = '';
    let savedFilterValue = '';

    if (section === 'productos') {
        const searchBox = document.getElementById('prod-search-input');
        if (searchBox) savedSearchValue = searchBox.value;
    } else if (section === 'reportes') {
        const searchBox = document.getElementById('rep-search');
        const filterBox = document.getElementById('rep-filter-type');
        if (searchBox) savedSearchValue = searchBox.value;
        if (filterBox) savedFilterValue = filterBox.value;
    }

    // --- LÓGICA NORMAL DE NAVEGACIÓN ---
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');

    let content = '';

    if (section === 'inicio') {
        const shift = db.currentShift;
        let htmlActions = '';

        if (!shift.isOpen) {
            htmlActions = `
                <div class="action-btns">
                    <button onclick="openModal('modal-open-cash')" class="btn btn-primary btn-wide">📂 Aperturar Caja</button>
                </div>
                <div class="bg-yellow-50 p-4 rounded border border-yellow-200 text-center">
                    <p class="text-yellow-800 font-bold">Caja Cerrada</p>
                </div>
            `;
        } else {
            htmlActions = `
                <div class="action-btns">
                    <button onclick="prepareCloseShift()" class="btn btn-danger btn-wide">🔒 Cerrar Caja</button>
                </div>
            `;
        }

        // MATEMÁTICA DEL DASHBOARD
        let statsHtml = '';
        if (shift.isOpen) {
            const totalCashBs = shift.openingAmountBs + shift.payments.efectivo - shift.changeGivenBs;
            const totalCashUsd = shift.openingAmountUsd + shift.payments.divisa - shift.changeGivenUsd;
            const totalDigital = (shift.payments.punto + shift.payments.pago_movil) - shift.changeGivenDigital;

            statsHtml = `
                <div class="dashboard-grid">
                    <div class="stat-card">
                        <div class="stat-label">Efectivo Bs</div>
                        <div class="stat-value">${totalCashBs.toFixed(2)} Bs</div>
                    </div>
                    <div class="stat-card" style="border-top-color: var(--secondary);">
                        <div class="stat-label">Efectivo $</div>
                        <div class="stat-value">${totalCashUsd.toFixed(2)} $</div>
                    </div>
                    <div class="stat-card" style="border-top-color: var(--success);">
                        <div class="stat-label">Punto / Pago Móvil</div>
                        <div class="stat-value">${totalDigital.toFixed(2)} Bs</div>
                    </div>
                    <div class="stat-card" style="border-top-color: var(--text-light);">
                        <div class="stat-label">Ventas Hoy</div>
                        <div class="stat-value">${shift.salesCount}</div>
                    </div>
                </div>
            `;
        }

        // LISTA DE VENTAS
        let salesHtml = '';
        if (db.sales.length === 0) {
            salesHtml = '<p class="text-center text-gray-500">No hay ventas en este turno.</p>';
        } else {
            salesHtml = `<h3 class="mb-3 font-bold">Historial del Turno</h3><div class="bg-white p-4 rounded shadow">`;
            db.sales.slice().reverse().forEach(sale => {
                let payDetail = [];
                if (sale.payments.efectivo > 0) payDetail.push(`${sale.payments.efectivo} Bs (Efec)`);
                if (sale.payments.divisa > 0) payDetail.push(`${sale.payments.divisa} $ (Divisa)`);
                if (sale.payments.pago_movil > 0) payDetail.push(`${sale.payments.pago_movil} Bs (PM)`);
                if (sale.payments.punto > 0) payDetail.push(`${sale.payments.punto} Bs (Punto)`);

                let changeText = '';
                if (sale.change.bs > 0) {
                    let methodText = sale.change.method === 'efectivo_bs' ? 'Efec Bs'
                        : sale.change.method === 'efectivo_usd' ? 'Divisa'
                            : 'Digital';
                    changeText = `<div class="text-xs text-blue-600 mt-1">Cambio: ${sale.change.bs.toFixed(2)} Bs (${methodText})</div>`;
                }

                const title = sale.type === 'opening'
                    ? `<span class="text-yellow-600 font-bold">📂 Apertura: ${sale.totals.bs} Bs / ${sale.totals.usd} $</span>`
                    : `Ticket #${sale.ticketNumber}`;

                salesHtml += `
                    <div class="sale-row">
                        <div class="sale-header">
                            <span>${title}</span>
                            <span class="text-sm font-normal text-gray-500">${new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="sale-details text-xs flex-col gap-1">
                            <div>Total: ${sale.totals.bs.toFixed(2)} Bs (${sale.totals.usd.toFixed(2)} $)</div>
                            <div class="font-bold text-gray-700">Pagado: ${payDetail.join(', ')}</div>
                            ${changeText}
                        </div>
                        ${sale.type !== 'opening' ? `
                        <button onclick="voidSale(${sale.id})" class="text-red-500 text-xs underline mt-1">Anular Venta</button>
                        ` : ''}
                    </div>
                `;
            });
            salesHtml += `</div>`;
        }

        content = `
            <h2 class="mb-4">Inicio - Caja del Día</h2>
            ${htmlActions}
            ${statsHtml}
            ${salesHtml}
        `;
    } else if (section === 'productos') {
        content = renderAdminProductsHTML();
    } else if (section === 'rentabilidad') {
        // 1. Cálculo del Saldo VISUAL (Basado en Capital Inicial + Ventas Activas)
        const shift = db.currentShift;

        const currentCashBs = db.config.initialCapitalBs + db.balance.cashBs + shift.payments.efectivo - shift.changeGivenBs;
        const currentCashUsd = db.config.initialCapitalUsd + db.balance.cashUsd + shift.payments.divisa - shift.changeGivenUsd;
        const currentBank = shift.payments.punto + shift.payments.pago_movil - shift.changeGivenDigital;
        const currentUsdt = db.balance.usdt; // USDT siempre maneja su propio historial


        const contentBalance = `
            <div class="balance-grid">
                <div class="balance-card">
                    <div class="stat-label">Efectivo Bs</div>
                    <div class="balance-val">${currentCashBs.toFixed(2)} Bs</div>
                </div>
                <div class="balance-card" style="border-top-color: var(--secondary);">
                    <div class="stat-label">Efectivo $</div>
                    <div class="balance-val">${currentCashUsd.toFixed(2)} $</div>
                </div>
                <div class="balance-card" style="border-top-color: var(--success);">
                    <div class="stat-label">Banco</div>
                    <div class="balance-val">${currentBank.toFixed(2)} Bs</div>
                </div>
                <div class="balance-card usdt">
                    <div class="stat-label">USDT</div>
                    <div class="balance-val">${currentUsdt.toFixed(2)} $</div>
                </div>
            </div>
        `;

        // 2. Gráfica Top 10
        const allSales = db.sales.concat(db.history).filter(s => s.type !== 'opening' && s.type !== 'closing' && s.type !== 'expense' && s.type !== 'transfer');
        const itemCounts = {};
        allSales.forEach(sale => {
            sale.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + item.qty;
            });
        });
        const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const maxQty = sortedItems.length > 0 ? sortedItems[0][1] : 1;

        let top10Html = '';
        if (sortedItems.length === 0) {
            top10Html = '<p class="text-center text-gray-500">Sin datos de ventas.</p>';
        } else {
            top10Html = `<h3 class="font-bold mb-2">🏆 Top 10 Productos</h3><div class="bg-white p-4 rounded shadow">`;
            sortedItems.forEach(([name, qty]) => {
                const percent = (qty / maxQty) * 100;
                top10Html += `
                    <div class="simple-bar-container">
                        <div class="simple-bar-label">
                            <span>${name}</span>
                            <span>${qty} uds</span>
                        </div>
                        <div class="simple-bar-bg">
                            <div class="simple-bar-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            });
            top10Html += `</div>`;
        }

        // 3. Mapa de Calor por Hora (0-23)
        const hourMap = Array(24).fill(0);
        allSales.forEach(sale => {
            const hour = new Date(sale.date).getHours();
            hourMap[hour] += sale.totals.bs;
        });
        // Determinar "calor" (máximo ventas)
        const maxHourSales = Math.max(...hourMap) || 1;

        let heatmapHtml = `<h3 class="font-bold mb-2 mt-4">🕒 Ventas por Hora</h3><div class="bg-white p-4 rounded shadow"><div class="heatmap-grid">`;
        for (let i = 0; i < 24; i++) {
            const sales = hourMap[i];
            const isActive = sales > 0 ? 'heat-active' : '';
            const opacity = sales > 0 ? (0.3 + (sales / maxHourSales) * 0.7) : 1;
            heatmapHtml += `
                <div class="heat-cell ${isActive}" style="opacity: ${opacity};">
                    ${i}h
                </div>
            `;
        }
        heatmapHtml += `</div></div>`;

        content = `
            <h2 class="mb-4">Rentabilidad</h2>
            <div class="flex gap-2 mb-4">
                <button onclick="openModal('modal-expense'); updateExpAccounts();" class="btn btn-danger w-full">💸 Registrar Gasto</button>
                <button onclick="openModal('modal-transfer')" class="btn btn-primary w-full">⇄ Transferencia</button>
            </div>
            ${contentBalance}
            <div class="grid md:grid-cols-2 gap-4">
                ${top10Html}
                ${heatmapHtml}
            </div>
        `;
    } else if (section === 'reportes') {
        // 1. Filtrar Datos (Fusionamos Sales actuales + Historial)
        const allRecords = db.sales.concat(db.history);
        const filterType = document.getElementById('rep-filter-type')?.value || 'all';
        const searchTerm = document.getElementById('rep-search')?.value.toLowerCase() || '';

        let filtered = allRecords.filter(r => {
            const matchesType = filterType === 'all' || r.type === filterType;
            const matchesSearch = r.concept ? r.concept.toLowerCase().includes(searchTerm)
                : r.dateStr.toLowerCase().includes(searchTerm);
            return matchesType && matchesSearch;
        });

        // Ordenar por fecha (más reciente primero)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 2. Generar Tabla HTML
        let rows = filtered.map(r => {
            let typeLabel = '';
            let amountBs = r.totals ? r.totals.bs : 0;
            let details = '';

            if (r.type === 'sale' || !r.type) {
                typeLabel = `<span class="text-green-600 font-bold">Venta #${r.ticketNumber}</span>`;
                details = `Total: ${amountBs.toFixed(2)} Bs`;
            } else if (r.type === 'opening') {
                typeLabel = `<span class="text-yellow-600">Apertura</span>`;
                details = `Efec: ${r.payments.efectivo} Bs / $${r.payments.divisa}`;
            } else if (r.type === 'closing') {
                typeLabel = `<span class="text-blue-600">Cierre</span>`;
                details = `Ventas: ${amountBs.toFixed(2)} Bs`;
            } else if (r.type === 'expense') {
                typeLabel = `<span class="text-red-600">Gasto</span>`;
                details = r.concept;
            } else if (r.type === 'transfer') {
                typeLabel = `<span class="text-purple-600">Transferencia</span>`;
                details = r.concept;
            }

            return `
                <tr>
                    <td class="text-xs text-gray-500">${r.dateStr}</td>
                    <td>${typeLabel}</td>
                    <td>${details}</td>
                    <td class="font-bold">${amountBs.toFixed(2)} Bs</td>
                </tr>
            `;
        }).join('');

        content = `
            <h2 class="mb-4">Reportes</h2>
            
            <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div class="report-filters">
                    <select id="rep-filter-type" class="filter-select" onchange="renderReportTable()">
                        <option value="all">Todo</option>
                        <option value="sale">Ventas</option>
                        <option value="opening">Aperturas</option>
                        <option value="closing">Cierres</option>
                        <option value="expense">Gastos</option>
                        <option value="transfer">Transferencias</option>
                    </select>
                    <input type="text" id="rep-search" class="filter-select" placeholder="Buscar concepto..." oninput="renderReportTable()" style="direction: ltr; text-align: left;">
                </div>
                <a href="#" onclick="downloadCSV()" class="download-btn">📥 Descargar Excel (.csv)</a>
            </div>

            <div style="overflow-x:auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Detalle</th>
                            <th>Banco (Bs)</th>
                            <th>Efec. Bs</th>
                            <th>Divisa ($)</th>
                            <th>USDT</th>
                        </tr>
                    </thead>
                    <tbody id="rep-table-body"></tbody>
                </table>
            </div>
        `;
    } else if (section === 'configuracion') {
        // === CONFIGURACIÓN ACTUALIZADA CON CATEGORÍAS ===
        const catRows = db.categories.map(c => `
            <tr>
                <td style="font-size:1.5rem;">${c.icon}</td>
                <td>${c.name}</td>
                <td>
                    <button class="btn-sm btn-edit" onclick="editCategory(${c.id})">Editar</button>
                    <button class="btn-sm btn-delete" onclick="deleteCategory(${c.id})">Eliminar</button>
                </td>
            </tr>
        `).join('');

        content = `
            <h2 class="mb-4">Configuración</h2>

            <div class="grid md:grid-cols-2 gap-4">

            <div class="bg-blue-50 p-4 rounded shadow border border-blue-200 mb-4">
                <h3 class="font-bold text-blue-800 mb-2">Capital Inicial de la Empresa</h3>
                <p class="text-sm text-blue-600 mb-2">Este dinero se sumará al total de Rentabilidad. Las aperturas de caja diarias NO se suman aquí.</p>
                <div class="flex gap-2">
                    <div class="w-full">
                        <label class="text-sm font-bold">Capital Efectivo Bs</label>
                        <input type="number" id="conf-init-bs" class="input-field" value="${db.config.initialCapitalBs}">
                    </div>
                    <div class="w-full">
                        <label class="text-sm font-bold">Capital Efectivo $</label>
                        <input type="number" id="conf-init-usd" class="input-field" value="${db.config.initialCapitalUsd}">
                    </div>
                </div>
                <button onclick="saveCapital()" class="btn btn-primary mt-2 w-full">Guardar Capital</button>
            </div>

                <!-- Sección Tasas -->
                <div class="bg-white p-4 rounded shadow">
                    <h3 class="font-bold mb-2">Tasas de Cambio</h3>
                    <div class="flex gap-2 mb-2">
                        <div class="w-full">
                            <label class="text-sm font-bold">Tasa Venta ($)</label>
                            <input type="number" id="conf-rate-usd" class="input-field" value="${db.config.rateUsd}">
                        </div>
                        <div class="w-full">
                            <label class="text-sm font-bold">Tasa Binance</label>
                            <input type="number" id="conf-rate-binance" class="input-field" value="${db.config.rateBinance}">
                        </div>
                    </div>
                    <button onclick="saveRates()" class="btn btn-primary">Actualizar Tasas</button>
                </div>

                <!-- Sección Seguridad -->
                <div class="bg-white p-4 rounded shadow">
                    <h3 class="font-bold mb-2">Seguridad</h3>
                    <button onclick="changePin()" class="btn btn-secondary w-full">Cambiar Clave Admin</button>
                </div>
            </div>

            <!-- Gestión de Categorías -->
            <div class="bg-white p-4 rounded shadow mt-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold">Gestión de Categorías</h3>
                    <button onclick="openCreateCategory()" class="btn btn-success" style="width:auto;">+ Nueva</button>
                </div>
                <div style="overflow-x:auto;">
                    <table class="admin-table">
                        <thead><tr><th>Icono</th><th>Nombre</th><th>Acciones</th></tr></thead>
                        <tbody>${catRows}</tbody>
                    </table>
                </div>
            </div>

            <!-- DENTRO de navTo('configuracion'), donde quieras que aparezca el botón -->
            <div class="bg-blue-50 p-4 rounded shadow border border-blue-200 mt-4">
                <h3 class="font-bold text-blue-800 mb-2">Cierre de Mes</h3>
                <p class="text-sm text-blue-600 mb-2">Descarga el reporte actual y borra el historial para empezar el mes nuevo. El dinero actual se guardará.</p>
                <button onclick="closeMonthAndReset()" class="btn btn-primary w-full">📅 Cerrar Mes y Reiniciar</button>
            </div>

            <!-- Zona de Peligro -->
            <div class="bg-red-50 p-4 rounded shadow border border-red-200 mt-4">
                <h3 class="font-bold text-red-600 mb-2">Zona de Peligro</h3>
                <button onclick="resetSystem()" class="btn btn-danger w-full">💥 BORRAR TODO Y REINICIAR</button>
            </div>
        `;
    }

    contentArea.innerHTML = content;

    // --- RESTAURAR FOCO (FIX) ---
    setTimeout(() => {
        if (section === 'productos') {
            renderProductTable();
        } else if (section === 'reportes') {
            renderReportTable();
        }
    }, 50); // Pequeño delay para que el navegador pinte el input primero
}

// ==========================================
// GESTIÓN DE PRODUCTOS ADMIN (TABLA)
// ==========================================
function renderAdminProductsHTML() {
    // 1. Llenar select del modal
    const catSelect = document.getElementById('new-prod-cat');
    if (catSelect) {
        catSelect.innerHTML = db.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // 3. Retornar el HTML WRAPPER (La tabla tendrá ID 'prod-table-body')
    return `
        <div class="flex justify-between items-center mb-4">
            <h2>Gestión de Productos</h2>
            <button onclick="openCreateModal()" class="btn btn-success" style="width:auto;">+ Nuevo Producto</button>
        </div>

        <!-- Buscador y Filtros -->
        <div class="admin-controls">
            <input type="text" id="prod-search-input" class="search-box" placeholder="🔍 Buscar por nombre..." style="direction: ltr; text-align: left;" oninput="renderProductTable()">
            <button id="btn-low-stock" class="filter-btn ${lowStockMode ? 'active' : ''}" onclick="toggleLowStock()">⚠️ Stock Bajo (< 11)</button>
        </div>

        <div style="overflow-x:auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Precio ($)</th>
                        <th>Precio (Bs)</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <!-- TBODY CON ID -->
                <tbody id="prod-table-body"></tbody>
            </table>
        </div>
    `;
}

function openCreateModal() {
    document.getElementById('modal-create-title').innerText = "Nuevo Producto";
    document.getElementById('edit-prod-id').value = "";
    document.getElementById('new-prod-name').value = "";
    document.getElementById('new-prod-price-usd').value = "";
    document.getElementById('new-prod-ings').value = "";

    // --- RESET DE STOCK AL CREAR ---
    document.getElementById('lbl-stock-mode').innerText = "Stock Inicial";
    document.getElementById('new-prod-stock').value = "";
    document.getElementById('current-stock-display').classList.add('hidden');

    openModal('modal-create-product');
}

function editProduct(id) {
    const p = db.products.find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('modal-create-title').innerText = "Editar Producto";
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('new-prod-name').value = p.name;
    document.getElementById('new-prod-cat').value = p.categoryId;
    document.getElementById('new-prod-price-usd').value = p.priceUsd;
    document.getElementById('new-prod-ings').value = p.ingredients ? p.ingredients.join(', ') : "";

    // --- LÓGICA DE STOCK AL EDITAR ---
    document.getElementById('lbl-stock-mode').innerText = "Ajuste de Stock (+ / -)";
    document.getElementById('new-prod-stock').value = ""; // Vacío para incentivar a escribir
    document.getElementById('current-stock-display').classList.remove('hidden');
    document.getElementById('val-current-stock').innerText = p.stock;

    openModal('modal-create-product');
}

function deleteProduct(id) {
    // Usamos nuestro modal personalizado en vez de confirm()
    showConfirm("¿Estás seguro de eliminar este producto?", () => {
        db.products = db.products.filter(p => p.id !== id);
        saveDB();
        navTo('productos');
        showToast("Producto eliminado");
    });
}

function saveProduct() {
    const idStr = document.getElementById('edit-prod-id').value;
    const name = document.getElementById('new-prod-name').value;
    const catId = parseInt(document.getElementById('new-prod-cat').value);
    const priceUsd = parseFloat(document.getElementById('new-prod-price-usd').value);
    const ingsStr = document.getElementById('new-prod-ings').value;
    const ingredients = ingsStr ? ingsStr.split(',').map(s => s.trim()) : [];

    // Input de Stock
    const stockInputStr = document.getElementById('new-prod-stock').value;
    const stockInputVal = stockInputStr === "" ? 0 : parseFloat(stockInputStr);

    if (!name || isNaN(priceUsd)) {
        showToast("Faltan datos obligatorios");
        return;
    }

    if (idStr) {
        // === MODO EDICIÓN ===
        const id = parseInt(idStr);
        const index = db.products.findIndex(p => p.id === id);
        if (index !== -1) {
            const currentStock = db.products[index].stock;
            let finalStock = currentStock;

            // Si el usuario escribió algo, sumamos (o restamos si es negativo)
            if (stockInputStr !== "") {
                finalStock = currentStock + stockInputVal;
            }

            if (finalStock < 0) {
                showToast(`Stock no puede ser negativo. Actual: ${currentStock}`);
                return;
            }

            db.products[index] = {
                ...db.products[index],
                name, categoryId: catId, priceUsd,
                stock: finalStock,
                ingredients
            };
            showToast("Producto y Stock actualizados");
        }
    } else {
        // === MODO CREACIÓN NUEVA ===
        if (isNaN(stockInputVal)) {
            showToast("Ingresa un stock inicial válido");
            return;
        }
        const newProd = {
            id: Date.now(),
            categoryId: catId,
            name: name,
            priceUsd: priceUsd,
            stock: stockInputVal, // Valor absoluto inicial
            image: '🍽️',
            ingredients: ingredients
        };
        db.products.push(newProd);
        showToast("Producto creado");
    }

    saveDB();
    closeModal('modal-create-product');
    navTo('productos');
}

// ==========================================
// UTILIDADES
// ==========================================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
});

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- SISTEMA DE CONFIRMACIÓN ---
let confirmCallback = null;
let cancelCallback = null;

function showConfirm(message, onConfirm, onCancel = null) {
    document.getElementById('confirm-msg').innerText = message;
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
    openModal('modal-confirm');
}

function closeConfirmModal() {
    closeModal('modal-confirm');
    // Si existe callback de cancelar, ejecutarlo
    if (cancelCallback) {
        cancelCallback();
        cancelCallback = null;
    }
    confirmCallback = null;
}

function executeConfirm() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

// ==========================================
// LÓGICA DEL CARRITO
// ==========================================

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    container.innerHTML = '';

    db.cart.forEach((item, index) => {
        const unitPriceUsd = (item.priceUsd || (item.priceBs / db.config.rateUsd)).toFixed(2);
        const totalItemBs = (item.priceBs * item.qty).toFixed(2);

        const row = document.createElement('div');
        row.className = 'cart-item-row';

        // HTML actualizado con controles + y -
        row.innerHTML = `
            <div class="cart-qty-control">
                <button class="qty-mini-btn" onclick="updateItemQty(${index}, -1)">-</button>
                <span class="qty-mini-val">${item.qty}</span>
                <button class="qty-mini-btn" onclick="updateItemQty(${index}, 1)">+</button>
            </div>
            
            <div class="cart-item-info" style="margin-left: 10px;">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-detail"> $${unitPriceUsd} c/u | ${totalItemBs} Bs ${item.note ? '| ' + item.note : ''}</div>
            </div>
            
            <div class="cart-remove-btn" onclick="confirmRemoveItem(${index})">&times;</div>
        `;
        container.appendChild(row);
    });
}

function removeCartItem(index) {
    // Devolver stock al eliminar item
    const item = db.cart[index];
    const prodIndex = db.products.findIndex(p => p.id === item.productId);
    if (prodIndex !== -1) {
        db.products[prodIndex].stock += item.qty;
    }

    db.cart.splice(index, 1);
    saveDB();
    updateCartBadge();
    renderCartItems();
    calculateTotals();

    if (db.cart.length === 0) {
        closeModal('modal-cart');
    }
}

function clearCart() {
    // 1. Cerrar el carrito para que no tape nada
    closeModal('modal-cart');

    // 2. Mostrar confirmación
    showConfirm(
        "¿Limpiar todo el carrito?",
        () => {
            // ACCIÓN SI (CONFIRMAR)
            // Devolver stock de todo
            db.cart.forEach(item => {
                const prodIndex = db.products.findIndex(p => p.id === item.productId);
                if (prodIndex !== -1) db.products[prodIndex].stock += item.qty;
            });

            db.cart = [];
            saveDB();
            updateCartBadge();
            showToast("Carrito limpio");
        },
        () => {
            // ACCIÓN SI CANCELAR (REABRIR CARRITO)
            abrirCarrito();
        }
    );
}


function calculateTotals() {
    // 1. Calcular Total de la Venta (en Bs)
    let totalSaleBs = 0;
    db.cart.forEach(item => {
        let itemPriceBs = item.priceBs || (item.priceUsd * db.config.rateUsd);
        totalSaleBs += (itemPriceBs * item.qty);
    });

    // 2. Sumar lo abonado (Leer los 4 inputs fijos)
    const effBs = parseFloat(document.getElementById('pay-efectivo').value) || 0;
    const pmBs = parseFloat(document.getElementById('pay-pm').value) || 0;
    const puntoBs = parseFloat(document.getElementById('pay-punto').value) || 0;
    const divUsd = parseFloat(document.getElementById('pay-divisa').value) || 0;

    const totalPaidBs = effBs + pmBs + puntoBs + (divUsd * db.config.rateUsd);

    const pending = totalSaleBs - totalPaidBs;
    const totalUsd = totalSaleBs / db.config.rateUsd;
    document.getElementById('lbl-total-to-pay').innerText = `${totalSaleBs.toFixed(2)} Bs ($${totalUsd.toFixed(2)})`;
    document.getElementById('lbl-total-paid').innerText = totalPaidBs.toFixed(2) + " Bs";
    const pendingUsd = pending / db.config.rateUsd;
    document.getElementById('lbl-pending').innerText = `${pending.toFixed(2)} Bs ($${pendingUsd.toFixed(2)})`;

    const pendingBox = document.getElementById('lbl-pending-box');
    if (pending <= 0.01) {
        pendingBox.style.opacity = '0';
        document.getElementById('lbl-final-total').innerText = totalPaidBs.toFixed(2) + " Bs";
    } else {
        pendingBox.style.opacity = '1';
        document.getElementById('lbl-final-total').innerText = "Pendiente...";
    }

    // 4. Calcular Cambio
    const changeContainer = document.getElementById('change-container');
    if (pending < 0) {
        changeContainer.classList.remove('hidden');
        const changeAmount = Math.abs(pending);
        document.getElementById('lbl-change-bs').innerText = "Devolver: " + changeAmount.toFixed(2) + " Bs";
        document.getElementById('lbl-change-usd').innerText = "Devolver: " + (changeAmount / db.config.rateUsd).toFixed(2) + " $";
    } else {
        changeContainer.classList.add('hidden');
    }
}

function processOrder() {
    // 1. Recalcular Totales
    let totalSaleBs = 0;
    db.cart.forEach(item => {
        let itemPriceBs = item.priceBs || (item.priceUsd * db.config.rateUsd);
        totalSaleBs += (itemPriceBs * item.qty);
    });

    // 2. Leer Pagos
    const effBs = parseFloat(document.getElementById('pay-efectivo').value) || 0;
    const pmBs = parseFloat(document.getElementById('pay-pm').value) || 0;
    const puntoBs = parseFloat(document.getElementById('pay-punto').value) || 0;
    const divUsd = parseFloat(document.getElementById('pay-divisa').value) || 0;

    const totalPaidBs = effBs + pmBs + puntoBs + (divUsd * db.config.rateUsd);

    // 3. Validar
    if (totalPaidBs < (totalSaleBs - 0.01)) {
        showToast("Falta dinero por cobrar");
        return;
    }

    // 4. Calcular Cambio (Vuelto)
    const changeBs = Math.abs(totalSaleBs - totalPaidBs); // Si pagan de más, esto es positivo
    const changeUsd = changeBs / db.config.rateUsd;
    const changeMethod = document.getElementById('change-method').value;

    // --- GUARDAR VENTA EN DB ---
    const ticketNumber = db.config.ticketCounter;
    const saleDate = new Date();

    const saleRecord = {
        id: Date.now(),
        ticketNumber: ticketNumber,
        date: saleDate,
        dateStr: saleDate.toLocaleString(),
        items: [...db.cart],
        totals: { bs: totalSaleBs, usd: totalSaleBs / db.config.rateUsd },
        payments: { efectivo: effBs, pago_movil: pmBs, punto: puntoBs, divisa: divUsd },
        change: { bs: changeBs, usd: changeUsd, method: changeMethod },
        status: 'active'
    };

    // --- ACTUALIZAR TURNO ACTUAL (CAJA) ---
    const shift = db.currentShift;
    shift.salesCount++;
    shift.totalSoldBs += totalSaleBs;

    // Sumar pagos brutos
    shift.payments.efectivo += effBs;
    shift.payments.pago_movil += pmBs;
    shift.payments.punto += puntoBs;
    shift.payments.divisa += divUsd;

    // ACUMULAR CAMBIO (Para restarlo del efectivo disponible)
    // Si el método de cambio es efectivo o divisa, resta de ese dinero físico
    if (changeMethod === 'efectivo_bs') {
        shift.changeGivenBs += changeBs;
    } else if (changeMethod === 'efectivo_usd') {
        shift.changeGivenUsd += changeUsd;
    } else if (changeMethod === 'punto') {
        // Si el cambio fue digital, lo restamos de los pagos digitales
        shift.changeGivenDigital += changeBs;
    }
    // Si el cambio fue por Pago Móvil/Banco, no afecta el efectivo físico en caja.

    // Guardar en ventas activas
    db.sales.push(saleRecord);
    db.config.ticketCounter++;
    saveDB();

    showToast(`¡Venta #${ticketNumber} Guardada!`);

    setTimeout(() => {
        printTicket(saleRecord); // Imprime el ticket recién creado
    }, 500);

    setTimeout(() => {
        db.cart = [];
        saveDB();
        updateCartBadge();
        closeModal('modal-cart');
        renderCategories();
    }, 1500);
}

//Funcion para imprimir

function printTicket(saleData) {
    const printArea = document.getElementById('print-area');
    
    // --- CABECERA ---
    let html = `
        <div class="text-center bold" style="font-size: 16px; margin-bottom: 5px;">MI POS</div>
        <div class="text-center" style="font-size: 10px; margin-bottom: 5px;">RIF: J-12345678-9</div>
        <div class="text-center" style="font-size: 10px; margin-bottom: 5px;">Ticket: #${saleData.ticketNumber || 'N/A'}</div>
        <div class="text-center" style="font-size: 10px; margin-bottom: 5px;">${new Date(saleData.date).toLocaleString()}</div>
        
        <!-- LÍNEA SEPARADORA 1 (Luego de Fecha) -->
        <p style="text-align: center; margin: 5px 0;">------------------------</p>
    `;

    // --- PRODUCTOS ---
    saleData.items.forEach(item => {
        const totalBs = (item.priceBs * item.qty).toFixed(2);
        const unitUsd = item.priceUsd.toFixed(2);
        
        html += `
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span>${item.qty} x ${item.name}</span>
            </div>
            <div style="font-size: 10px; color: #555; margin-left: 5px;">
                ${item.note ? '|' + item.note : ''}
            </div> 
        `;
    });

    // --- TOTALES ---
    html += `
        <!-- LÍNEA SEPARADORA 2 (Fin del pedido) -->
        <p style="text-align: center; margin: 5px 0;">------------------------</p>
        
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span class="bold">SUBTOTAL:</span>
            <span>${saleData.totals.bs.toFixed(2)} Bs</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span class="bold">TOTAL USD:</span>
            <span>${saleData.totals.usd.toFixed(2)} $</span>
        </div>
    `;

    // --- PIE DE PÁGINA ---
    html += `<div class="text-center" style="font-size: 10px; margin-bottom: 5px;">¡Gracias por su compra!</div>`; 
    html += `<p style="text-align: center; margin: 5px 0;">////////////////////////</p>`;
    html += `<p style="text-align: center; margin: 5px 0;">////////////////////////</p>`;
   

    // --- ESPACIO EN BLANCO AL FINAL (Para que no corte el texto) ---
    html += `<div class="print-spacer">Bienvenido a </div>`;

    // === MAGIA DE DOBLE IMPRESIÓN ===
    // Tomamos todo el HTML generado (html) y lo pegamos dos veces seguidas.
    // La impresora leerá esto como un ticket largo e imprimirá el segundo inmediatamente.
    const ticketDoble = html + html;

    // Inyectamos al área de impresión
    printArea.innerHTML = ticketDoble;

    // Lanzar impresión
    window.print();
}

//<p style="text-align: center; margin: 5px 0;">------------------------</p>

function updateItemQty(index, delta) {
    const item = db.cart[index];
    const newQty = item.qty + delta;

    if (newQty < 1) {
        // Devolver stock del item que vamos a eliminar
        const prodIndex = db.products.findIndex(p => p.id === item.productId);
        if (prodIndex !== -1) {
            db.products[prodIndex].stock += item.qty;
        }

        db.cart.splice(index, 1);
        saveDB();
        updateCartBadge();

        if (db.cart.length === 0) {
            closeModal('modal-cart');
        } else {
            renderCartItems();
            calculateTotals();
        }
        return;
    }

    if (delta > 0) {
        const prod = db.products.find(p => p.id === item.productId);
        if (prod) {
            // LÓGICA CORREGIDA:
            // El Stock en DB ya ha sido descontado por los items actuales en el carrito.
            // Por eso, sumamos la cantidad actual del carrito (item.qty) al stock de DB (prod.stock).
            // Si (Cantidad Nueva > (Stock Disponible + Cantidad Actual)), no hay stock suficiente.
            const availableStock = prod.stock + item.qty;

            if (newQty > availableStock) {
                showToast(`Stock insuficiente. Solo quedan ${availableStock} disponibles.`);
                return;
            }
        }
    }

    item.qty = newQty;

    const prodIndex = db.products.findIndex(p => p.id === item.productId);
    if (prodIndex !== -1) {
        // Restamos el delta (si sumamos, restamos 1 al stock; si restamos, sumamos 1 al stock)
        db.products[prodIndex].stock -= delta;
    }

    saveDB();
    renderCartItems();
    updateCartBadge();
    calculateTotals();
}

function confirmRemoveItem(index) {
    // Usamos el modal de confirmación
    showConfirm("¿Eliminar este producto del carrito?", () => {
        // Devolver stock al eliminar
        const item = db.cart[index];
        const prodIndex = db.products.findIndex(p => p.id === item.productId);
        if (prodIndex !== -1) {
            db.products[prodIndex].stock += item.qty;
        }

        db.cart.splice(index, 1);
        saveDB();
        updateCartBadge();

        if (db.cart.length === 0) {
            closeModal('modal-cart');
        } else {
            renderCartItems();
            calculateTotals();
        }
    });
}

// --- GESTIÓN DE CAJA (FASE 5) ---

function confirmOpenShift() {
    const bs = parseFloat(document.getElementById('open-cash-bs').value) || 0;
    const usd = parseFloat(document.getElementById('open-cash-usd').value) || 0;

    db.currentShift.isOpen = true;
    db.currentShift.openingAmountBs = bs;
    db.currentShift.openingAmountUsd = usd;

    // IMPORTANTE: NO modificamos db.balance. La apertura es solo dinero interno del cajón.

    // Guardar registro de apertura
    db.sales.push({
        id: Date.now(),
        type: 'opening',
        date: new Date(),
        dateStr: "Apertura de Caja - " + new Date().toLocaleString(),
        totals: { bs: bs, usd: usd },
        items: [],
        payments: { efectivo: bs, divisa: usd },
        change: { bs: 0, usd: 0 }
    });

    saveDB();
    closeModal('modal-open-cash');
    navTo('inicio');
    showToast("Caja Aperturada Correctamente");
}

function prepareCloseShift() {
    document.getElementById('close-summary-sales').innerText = db.currentShift.salesCount;
    document.getElementById('close-summary-total').innerText = db.currentShift.totalSoldBs.toFixed(2) + " Bs";
    openModal('modal-close-cash');
}

function confirmCloseShift() {
    // 1. Guardar reporte de cierre en el HISTORIAL
    const shift = db.currentShift;

    db.history.push({
        id: Date.now(),
        type: 'closing',
        date: new Date(),
        dateStr: "Cierre de Turno - " + new Date().toLocaleString(),
        totals: { bs: shift.totalSoldBs, usd: shift.totalSoldBs / db.config.rateUsd },
        items: [],
        payments: shift.payments
    });

    // 2. Mover todas las ventas activas al historial
    db.history = db.history.concat(db.sales);

    // === IMPORTANTE: ACTUALIZAR EL BALANCE GLOBAL CON LOS RESULTADOS NETOS ===
    // Calculamos cuánto dinero REAL hay en el turno actual
    const netCashBs = shift.openingAmountBs + shift.payments.efectivo - shift.changeGivenBs;
    const netCashUsd = shift.openingAmountUsd + shift.payments.divisa - shift.changeGivenUsd;
    const netBank = shift.payments.punto + shift.payments.pago_movil - shift.changeGivenDigital;

    // Sumamos ese resultado al balance global de la empresa
    db.balance.cashBs += (shift.payments.efectivo - shift.changeGivenBs);
    db.balance.cashUsd += (shift.payments.divisa - shift.changeGivenUsd);
    db.balance.bank += (shift.payments.punto + shift.payments.pago_movil - shift.changeGivenDigital);

    // 3. Limpiar Ventas Activas
    db.sales = [];

    // 4. Resetear Turno
    db.currentShift = {
        isOpen: false,
        openingAmountBs: 0,
        openingAmountUsd: 0,
        payments: { efectivo: 0, pago_movil: 0, punto: 0, divisa: 0 },
        changeGivenBs: 0,
        changeGivenUsd: 0,
        changeGivenDigital: 0,
        salesCount: 0,
        totalSoldBs: 0
    };

    // 5. Reiniciar tickets
    db.config.ticketCounter = 1;

    saveDB();
    closeModal('modal-close-cash');
    navTo('inicio');
    showToast("Cierre Realizado y Balance Actualizado.");
}

function voidSale(saleId) {
    showConfirm("¿Anular venta? Se restaurará stock y contabilidad.", () => {
        const saleIndex = db.sales.findIndex(s => s.id === saleId);
        if (saleIndex === -1) return;
        const sale = db.sales[saleIndex];

        // 1. Restaurar Stock
        sale.items.forEach(item => {
            const prodIndex = db.products.findIndex(p => p.id === item.productId);
            if (prodIndex !== -1) db.products[prodIndex].stock += item.qty;
        });

        // 2. Restituir Pagos
        const shift = db.currentShift;
        shift.salesCount--;
        shift.totalSoldBs -= sale.totals.bs;

        shift.payments.efectivo -= sale.payments.efectivo;
        shift.payments.pago_movil -= sale.payments.pago_movil;
        shift.payments.punto -= sale.payments.punto;
        shift.payments.divisa -= sale.payments.divisa;

        // 3. RESTITUIR EL CAMBIO (Sumar lo que restamos)
        if (sale.change.bs > 0) {
            if (sale.change.method === 'efectivo_bs') {
                shift.changeGivenBs -= sale.change.bs;
            } else if (sale.change.method === 'efectivo_usd') {
                shift.changeGivenUsd -= sale.change.usd;
            } else if (sale.change.method === 'punto') {
                shift.changeGivenDigital -= sale.change.bs;
            }
        }

        // 4. Eliminar venta
        db.sales.splice(saleIndex, 1);
        saveDB();
        navTo('inicio');
        showToast("Venta Anulada y Caja Actualizada");
    });
}

// --- FUNCIONES DE CONFIGURACIÓN (FASE 8 ADELANTADA) ---

function saveRates() {
    const usd = parseFloat(document.getElementById('conf-rate-usd').value);
    const binance = parseFloat(document.getElementById('conf-rate-binance').value);

    if (usd > 0) db.config.rateUsd = usd;
    if (binance > 0) db.config.rateBinance = binance;

    saveDB();
    showToast("Tasas actualizadas correctamente");
}

function saveCapital() {
    const bs = parseFloat(document.getElementById('conf-init-bs').value) || 0;
    const usd = parseFloat(document.getElementById('conf-init-usd').value) || 0;
    db.config.initialCapitalBs = bs;
    db.config.initialCapitalUsd = usd;
    saveDB();
    showToast("Capital Inicial Actualizado");
    navTo('rentabilidad');
}

function changePin() {
    const newPin = prompt("Ingrese la NUEVA clave de acceso:");
    if (newPin && newPin.length === 4) {
        db.config.pin = newPin;
        saveDB();
        showToast("Clave cambiada con éxito");
    } else {
        showToast("La clave debe tener 4 números");
    }
}

function resetSystem() {
    showConfirm(
        "¿ESTÁS SEGURO? Se borrará TODO. No hay vuelta atrás.",
        () => {
            localStorage.removeItem('pos_db');
            location.reload(); // Recargar la página para reiniciar todo
        }
    );
}

// --- GESTIÓN FINANCIERA (ACTUALIZADA) ---

function updateExpAccounts() {
    const currency = document.getElementById('exp-currency').value;
    const select = document.getElementById('exp-account');
    select.innerHTML = '';

    if (currency === 'bs') {
        select.innerHTML = `
            <option value="cashBs">Efectivo Bs</option>
            <option value="bank">Banco (Bs)</option>
        `;
    } else if (currency === 'usd') {
        select.innerHTML = `<option value="cashUsd">Efectivo $</option>`;
    } else if (currency === 'usdt') {
        select.innerHTML = `<option value="usdt">USDT</option>`;
    }
}

function saveExpense() {
    const concept = document.getElementById('exp-concept').value;
    const currency = document.getElementById('exp-currency').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const account = document.getElementById('exp-account').value;

    if (!concept || isNaN(amount) || amount <= 0) {
        showToast("Datos inválidos");
        return;
    }

    // Calcular valor en Bs (para reportes) y restar del saldo correspondiente
    let amountBs = 0;
    let amountUsd = 0;
    let amountUsdt = 0;

    if (currency === 'bs') {
        db.balance.cashBs -= amount; // o db.balance.bank si selecciona banco
        if (account === 'bank') db.balance.bank -= amount;
        amountBs = amount;
    } else if (currency === 'usd') {
        db.balance.cashUsd -= amount;
        // Convertir a Bs para el reporte
        amountBs = amount * db.config.rateUsd;
        amountUsd = amount;
    } else if (currency === 'usdt') {
        db.balance.usdt -= amount;
        // Convertir a Bs para el reporte (usamos tasa binance para gastos USDT)
        amountBs = amount * db.config.rateBinance;
        amountUsdt = amount;
    }

    // Guardar en historial
    db.history.push({
        id: Date.now(),
        type: 'expense',
        date: new Date(),
        dateStr: new Date().toLocaleString(),
        concept: concept,
        currency: currency, // Guardar moneda original
        amount: amount, // Monto original
        totals: { bs: amountBs, usd: amountUsd, usdt: amountUsdt }, // Valores para reporte
        items: [],
        payments: {},
        change: {}
    });

    saveDB();
    closeModal('modal-expense');
    navTo('rentabilidad');
    showToast("Gasto Registrado");
}

function saveTransfer() {
    const from = document.getElementById('trans-from').value;
    const to = document.getElementById('trans-to').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);

    if (from === to) {
        showToast("Origen y Destino no pueden ser iguales");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showToast("Monto inválido");
        return;
    }

    // Lógica de rutas permitidas:
    // 1. Bank -> USDT (Conversión)
    // 2. Cash Bs -> USDT (Conversión)
    // 3. Bank -> Bank (Movimiento interno 1:1)

    let amountBs = amount;
    let amountUsdt = 0;
    let conceptStr = "";

    // RESTAR DEL ORIGEN
    if (from === 'bank') db.balance.bank -= amountBs;
    if (from === 'cashBs') db.balance.cashBs -= amountBs;

    // SUMAR AL DESTINO
    if (to === 'usdt') {
        // Convertir a USDT usando Tasa Binance
        amountUsdt = amountBs / db.config.rateBinance;
        db.balance.usdt += amountUsdt;
        conceptStr = `Transferencia: ${from} -> USDT`;
    } else if (to === 'bank') {
        // Mover al Banco (Asumimos 1:1 en Bs)
        db.balance.bank += amountBs;
        conceptStr = `Transferencia: ${from} -> Banco`;
    }

    // Guardar en historial
    db.history.push({
        id: Date.now(),
        type: 'transfer',
        date: new Date(),
        dateStr: new Date().toLocaleString(),
        concept: conceptStr,
        totals: { bs: amountBs, usdt: amountUsdt },
        from: from,
        to: to,
        items: [],
        payments: {},
        change: {}
    });

    saveDB();
    closeModal('modal-transfer');
    navTo('rentabilidad');
    showToast("Transferencia Realizada");
}

// --- FUNCIONES DE REPORTES Y CATEGORÍAS (FASE 7) ---

function downloadCSV() {
    const allRecords = db.sales.concat(db.history);

    // 1. Calcular Totales para el pie de página
    let totalBank = 0;
    let totalCashBs = 0;
    let totalCashUsd = 0;
    let totalUsdt = 0;

    allRecords.forEach(r => {
        // Calcular montos por columna
        let bank = 0;
        let cashBs = 0;
        let cashUsd = 0;
        let usdt = 0;

        if (r.payments) {
            bank = (r.payments.pago_movil || 0) + (r.payments.punto || 0);
            cashBs = (r.payments.efectivo || 0);
            cashUsd = (r.payments.divisa || 0);
        }
        if (r.type === 'transfer' && r.totals && r.totals.usdt) {
            usdt = r.totals.usdt;
        }
        // Gastos se restan (negativos)
        if (r.type === 'expense') {
            let amount = r.amount || (r.totals.bs); // Asumimos Bs por defecto si viene de viejos datos
            if (r.currency === 'usd') { amount = amount / db.config.rateUsd; cashUsd = -amount; }
            else if (r.currency === 'usdt') { usdt = -amount; }
            else {
                if (r.account === 'cashBs') cashBs = -amount;
                if (r.account === 'bank') bank = -amount;
            }
        }

        // Sumar a los totales globales
        totalBank += bank;
        totalCashBs += cashBs;
        totalCashUsd += cashUsd;
        totalUsdt += usdt;
    });

    // Sumar Capital Inicial a los totales del reporte final
    totalCashBs += db.config.initialCapitalBs;
    totalCashUsd += db.config.initialCapitalUsd;

    // 2. Crear Cabecera CSV
    let csvContent = "Fecha,Hora,Tipo,Detalle,Banco (BS/Punto),Efec BS,Divisa $,USDT\n";

    // 3. Generar Filas
    allRecords.forEach(r => {
        const dateObj = new Date(r.date);
        const date = dateObj.toLocaleDateString();
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let type = r.type || 'sale';
        let detail = r.concept || (r.ticketNumber ? `Venta #${r.ticketNumber}` : '');

        let bank = 0;
        let cashBs = 0;
        let cashUsd = 0;
        let usdt = 0;

        if (r.payments) {
            bank = (r.payments.pago_movil || 0) + (r.payments.punto || 0);
            cashBs = (r.payments.efectivo || 0);
            cashUsd = (r.payments.divisa || 0);
        }
        if (r.type === 'transfer' && r.totals && r.totals.usdt) usdt = r.totals.usdt;

        if (r.type === 'expense') {
            // Lógica de negativos para gastos
            let amount = r.amount || (r.totals.bs);
            let account = r.account || 'cashBs'; // Fallback

            if (r.currency === 'usd') cashUsd = -amount;
            else if (r.currency === 'usdt') usdt = -amount;
            else {
                if (account === 'cashBs') cashBs = -amount;
                if (account === 'bank') bank = -amount;
            }
        }

        csvContent += `${date},${time},${type},"${detail}",${bank.toFixed(2)},${cashBs.toFixed(2)},${cashUsd.toFixed(2)},${usdt.toFixed(2)}\n`;
    });

    // === 4. TOTALES DE RENTABILIDAD (FÓRMULA EXACTA DE LA PANTALLA) ===
    const shift = db.currentShift;

    const finalCashBs = db.config.initialCapitalBs + db.balance.cashBs + shift.payments.efectivo - shift.changeGivenBs;

    const finalCashUsd = db.config.initialCapitalUsd + db.balance.cashUsd + shift.payments.divisa - shift.changeGivenUsd;

    const finalBank = db.balance.bank + shift.payments.punto + shift.payments.pago_movil - shift.changeGivenDigital;

    const finalUsdt = db.balance.usdt;

    csvContent += `TOTAL,,,,${finalBank.toFixed(2)},${finalCashBs.toFixed(2)},${finalCashUsd.toFixed(2)},${finalUsdt.toFixed(2)}\n`;



    // 5. Descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.getElementById('csv-download');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Completo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- GESTIÓN DE CATEGORÍAS ---

function openCreateCategory() {
    document.getElementById('cat-modal-title').innerText = "Nueva Categoría";
    document.getElementById('cat-id').value = "";
    document.getElementById('cat-name').value = "";
    document.getElementById('cat-icon').value = "";
    openModal('modal-category');
}

function editCategory(id) {
    const cat = db.categories.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('cat-modal-title').innerText = "Editar Categoría";
    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-icon').value = cat.icon;
    openModal('modal-category');
}

function saveCategory() {
    const idStr = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value;
    const icon = document.getElementById('cat-icon').value || '📂';

    if (!name) {
        showToast("Falta el nombre de la categoría");
        return;
    }

    if (idStr) {
        // Editar
        const id = parseInt(idStr);
        const index = db.categories.findIndex(c => c.id === id);
        if (index !== -1) {
            db.categories[index].name = name;
            db.categories[index].icon = icon;
            showToast("Categoría actualizada");
        }
    } else {
        // Crear
        db.categories.push({ id: Date.now(), name, icon });
        showToast("Categoría creada");
    }

    saveDB();
    closeModal('modal-category');
    navTo('configuracion'); // Refrescar lista
}

function deleteCategory(id) {
    // Verificar si hay productos usando esta categoría
    const hasProducts = db.products.some(p => p.categoryId === id);
    if (hasProducts) {
        showConfirm("Hay productos usando esta categoría. Si la eliminas, los productos quedarán sin categoría. ¿Borrar de todas formas?", () => {
            db.categories = db.categories.filter(c => c.id !== id);
            saveDB();
            navTo('configuracion');
            showToast("Categoría eliminada");
        });
    } else {
        showConfirm("¿Eliminar esta categoría?", () => {
            db.categories = db.categories.filter(c => c.id !== id);
            saveDB();
            navTo('configuracion');
            showToast("Categoría eliminada");
        });
    }
}

// === FUNCIÓN AUXILIAR PARA RENDERIZAR SOLO LA TABLA DE REPORTES ===
// Esto evita que se borre el input y pierda el foco al escribir
function renderReportTable() {
    const allRecords = db.sales.concat(db.history);
    const filterType = document.getElementById('rep-filter-type')?.value || 'all';
    const searchTerm = document.getElementById('rep-search')?.value.toLowerCase() || '';

    let filtered = allRecords.filter(r => {
        const matchesType = filterType === 'all' || r.type === filterType;
        // Buscamos en concepto o en la fecha
        const matchesSearch = r.concept ? r.concept.toLowerCase().includes(searchTerm)
            : r.dateStr.toLowerCase().includes(searchTerm);
        return matchesType && matchesSearch;
    });

    // Ordenar por fecha (más reciente primero)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('rep-table-body');
    if (!tbody) return;

    let rows = filtered.map(r => {
        // Variables para las columnas
        let bank = 0;
        let cashBs = 0;
        let cashUsd = 0;
        let usdt = 0;

        // --- LÓGICA POR TIPO DE REGISTRO ---

        if (r.type === 'sale' || !r.type) {
            // VENTA: Sumamos a las cuentas donde se pagó
            if (r.payments) {
                bank = (r.payments.pago_movil || 0) + (r.payments.punto || 0);
                cashBs = (r.payments.efectivo || 0) - (r.change?.bs || 0); // Efectivo neto (menos cambio)
                cashUsd = (r.payments.divisa || 0) - (r.change?.usd || 0);
            }
        }
        else if (r.type === 'opening') {
            // APERTURA: Se considera entrada de dinero al fondo
            if (r.payments) {
                cashBs = r.payments.efectivo || 0;
                cashUsd = r.payments.divisa || 0;
            }
        }
        else if (r.type === 'closing') {
            // CIERRE: Solo informativo en el detalle, no sumamos para no duplicar en el reporte
            // (El cierre es la suma de todo lo anterior)
        }
        else if (r.type === 'expense') {
            // GASTO: Restamos de la cuenta seleccionada
            let amount = r.amount || 0;
            let currency = r.currency || 'bs';

            if (currency === 'usd') {
                cashUsd = -amount;
            } else if (currency === 'usdt') {
                usdt = -amount;
            } else {
                // Bs
                if (r.account === 'bank') bank = -amount;
                else cashBs = -amount;
            }
        }
        else if (r.type === 'transfer') {
            // TRANSFERENCIA: (Requiere que hayas hecho el Paso 3 para funcionar 100% en futuros registros)
            // Si el registro tiene 'from' y 'to' (nuevo formato):
            if (r.from && r.to) {
                // Restamos del ORIGEN
                if (r.from === 'bank') bank = -r.totals.bs;
                if (r.from === 'cashBs') cashBs = -r.totals.bs;

                // Sumamos al DESTINO
                if (r.to === 'bank') bank += r.totals.bs; // Raro bank a bank pero posible
                if (r.to === 'usdt') usdt = r.totals.usdt;
            } else {
                // Fallback para registros viejos que no tienen from/to guardado
                // Intentamos adivinar por el concepto o el total de usdt
                if (r.totals && r.totals.usdt > 0) {
                    usdt = r.totals.usdt; // Asumimos que llegó a USDT
                    // Asumimos que salió de Efectivo Bs (por defecto del sistema)
                    cashBs = -r.totals.bs;
                }
            }
        }

        // Formatear números (ocultar si es 0)
        const fmt = (n) => n !== 0 ? n.toFixed(2) : '-';

        // Estilo de texto (Rojo si es negativo)
        const style = (n) => n < 0 ? 'color: var(--danger);' : '';

        // Determinar etiqueta y detalle
        let typeLabel = '';
        let details = r.concept || '';

        if (r.type === 'sale' || !r.type) typeLabel = `<span class="text-green-600 font-bold">Venta</span>`;
        else if (r.type === 'opening') typeLabel = `<span class="text-yellow-600">Apertura</span>`;
        else if (r.type === 'closing') typeLabel = `<span class="text-blue-600">Cierre</span>`;
        else if (r.type === 'expense') typeLabel = `<span class="text-red-600">Gasto</span>`;
        else if (r.type === 'transfer') typeLabel = `<span class="text-purple-600">Transferencia</span>`;

        return `
            <tr>
                <td class="text-xs text-gray-500">${r.dateStr.split(',')[0]}</td>
                <td>${typeLabel}</td>
                <td>${details}</td>
                <td class="text-right" style="${style(bank)}">${fmt(bank)}</td>
                <td class="text-right" style="${style(cashBs)}">${fmt(cashBs)}</td>
                <td class="text-right" style="${style(cashUsd)}">${fmt(cashUsd)}</td>
                <td class="text-right" style="${style(usdt)}">${fmt(usdt)}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows.length > 0 ? rows : '<tr><td colspan="7" class="text-center p-4">No hay registros</td></tr>';
}

function closeMonthAndReset() {
    if (!confirm("¿CERRAR MES?\n\n1. Se descargará el reporte Excel (.csv)\n2. El historial se borrará.\n3. El dinero actual pasará a ser 'Capital Inicial'.")) {
        return;
    }

    // 1. Descargar Reporte
    downloadCSV();

    // 2. Calcular el dinero ACTUAL exacto (Igual que en Rentabilidad)
    const shift = db.currentShift;
    const finalCashBs = db.config.initialCapitalBs + db.balance.cashBs + shift.payments.efectivo - shift.changeGivenBs;
    const finalCashUsd = db.config.initialCapitalUsd + db.balance.cashUsd + shift.payments.divisa - shift.changeGivenUsd;
    const finalBank = db.balance.bank + shift.payments.punto + shift.payments.pago_movil - shift.changeGivenDigital;
    const finalUsdt = db.balance.usdt;

    // 3. Pasar ese dinero a Capital Inicial (Para que no desaparezca de la pantalla)
    db.config.initialCapitalBs = finalCashBs;
    db.config.initialCapitalUsd = finalCashUsd;

    // 4. Limpiar Historial y Ventas
    db.sales = [];
    db.history = [];

    // 5. Resetear Balances a 0 (porque ahora todo es "Capital Inicial")
    db.balance = { cashBs: 0, cashUsd: 0, bank: 0, usdt: 0 };

    // 6. Reiniciar Turno (opcional, si quieres empezar el mes con turno cerrado)
    db.currentShift.isOpen = false;
    db.currentShift.salesCount = 0;
    db.currentShift.totalSoldBs = 0;

    saveDB();
    showToast("¡Mes Cerrado! Nuevo ciclo iniciado.");
    navTo('inicio');
}