/**
 * ============================================================================
 *  catalog.js — каталог YourProjectName [ВАРИАНТ GR]
 *  Роли:
 *    guest   — только отображение карточек
 *    user    — кнопка «В корзину», блок корзины
 *    manager — форма CRUD товаров + базовая сортировка
 *    admin   — расширенные поля сортировки + кнопка админ-панели
 * ============================================================================
 */

let currentUser = null;

const ROLE_LABELS = {
  guest: 'Гость',
  user: 'Пользователь',
  manager: 'Менеджер',
  admin: 'Админ',
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }
  setupUI();
  await loadProducts();
  bindEvents();
});

/** Загрузка сессии с сервера */
async function loadUser() {
  const res = await fetch('/api/me');
  const data = await res.json();
  currentUser = data.user;
}

/** Показать/скрыть элементы по роли */
function setupUI() {
  const badge = document.getElementById('role-badge');
  const greeting = document.getElementById('user-greeting');
  if (badge) {
    badge.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
    badge.classList.add(currentUser.role);
  }
  if (greeting) {
    greeting.textContent = `Добро пожаловать, ${currentUser.fullName || currentUser.login}! `;
  }

  const hint = document.getElementById('role-hint-text');
  if (hint) {
    const hints = {
      guest: 'Режим гостя: только просмотр каталога YourProjectName.',
      user: 'Пользователь: можно добавлять товары в корзину и оформлять заказ.',
      manager: 'Менеджер: управление карточками товаров и базовая сортировка.',
      admin: 'Администратор: полный доступ + админ-панель.',
    };
    hint.textContent = hints[currentUser.role] || '';
  }

  // Гость: скрыть сортировку (по ТЗ только просмотр — сортировку можно оставить для удобства или скрыть)
  const sortToolbar = document.getElementById('sort-toolbar');
  if (currentUser.role === 'guest' && sortToolbar) {
    sortToolbar.classList.add('hidden');
  }

  // Пользователь: корзина
  if (['user', 'manager', 'admin'].includes(currentUser.role)) {
    document.getElementById('cart-section')?.classList.remove('hidden');
    loadCart();
  }

  // Менеджер и админ: управление товарами
  if (['manager', 'admin'].includes(currentUser.role)) {
    document.getElementById('manager-section')?.classList.remove('hidden');
  }

  // Админ: расширенная сортировка + кнопка админ-панели
  if (currentUser.role === 'admin') {
    document.querySelectorAll('.sort-admin-only').forEach((el) => el.classList.remove('hidden'));
    document.getElementById('btn-admin-panel')?.classList.remove('hidden');
  }
}

function bindEvents() {
  document.getElementById('btn-refresh')?.addEventListener('click', loadProducts);
  document.getElementById('sort-by')?.addEventListener('change', loadProducts);
  document.getElementById('sort-order')?.addEventListener('change', loadProducts);
  document.getElementById('btn-checkout')?.addEventListener('click', checkout);
  document.getElementById('product-form')?.addEventListener('submit', saveProduct);
  document.getElementById('product-form-reset')?.addEventListener('click', resetProductForm);
}

/** Загрузка товаров с учётом сортировки */
async function loadProducts() {
  const sortBy = document.getElementById('sort-by')?.value || 'name';
  const order = document.getElementById('sort-order')?.value || 'asc';
  const qs = new URLSearchParams({ sortBy, order });
  const res = await fetch(`/api/products?${qs}`);
  if (!res.ok) return;
  const data = await res.json();
  renderProducts(data.products);
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = products
    .map((p) => {
      const canCart = currentUser.role === 'user';
      const canManage = ['manager', 'admin'].includes(currentUser.role);
      return `
        <article class="product-card" data-id="${p.id}">
          <div class="product-card-header">${escapeHtml(p.category)}</div>
          <div class="product-card-body">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.description)}</p>
            <div class="product-price">${p.price} ₽</div>
            <div class="product-meta">
              Остаток: ${p.stock} шт. · Дата: ${p.publishedAt}
            </div>
            <div class="product-actions">
              ${canCart ? `<button type="button" class="btn btn-primary btn-sm btn-add-cart" data-id="${p.id}">В корзину</button>` : ''}
              ${canManage ? `
                <button type="button" class="btn btn-secondary btn-sm btn-edit" data-id="${p.id}">Изменить</button>
                <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${p.id}">Удалить</button>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => fillProductForm(btn.dataset.id, products));
  });
  grid.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
  });
}

async function addToCart(productId) {
  const res = await fetch('/api/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, qty: 1 }),
  });
  if (res.ok) loadCart();
  else alert((await res.json()).error || 'Ошибка');
}

async function loadCart() {
  const res = await fetch('/api/cart');
  if (!res.ok) return;
  const data = await res.json();
  const list = document.getElementById('cart-list');
  const totalEl = document.getElementById('cart-total');
  if (!list) return;
  let total = 0;
  list.innerHTML = data.cart
    .map((item) => {
      const sum = item.price * item.qty;
      total += sum;
      return `<li>${escapeHtml(item.name)} × ${item.qty} — ${sum} ₽</li>`;
    })
    .join('');
  if (totalEl) totalEl.textContent = total;
}

async function checkout() {
  const res = await fetch('/api/cart/checkout', { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    alert('Заказ оформлен! №' + data.order.id);
    loadCart();
  } else alert(data.error || 'Ошибка');
}

function fillProductForm(id, products) {
  const p = products.find((x) => x.id === Number(id));
  if (!p) return;
  document.getElementById('product-id').value = p.id;
  document.getElementById('product-name').value = p.name;
  document.getElementById('product-desc').value = p.description;
  document.getElementById('product-price').value = p.price;
  document.getElementById('product-category').value = p.category;
  document.getElementById('product-stock').value = p.stock;
  document.getElementById('product-date').value = p.publishedAt;
}

function resetProductForm() {
  document.getElementById('product-form')?.reset();
  document.getElementById('product-id').value = '';
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const body = {
    name: document.getElementById('product-name').value,
    description: document.getElementById('product-desc').value,
    price: document.getElementById('product-price').value,
    category: document.getElementById('product-category').value,
    stock: document.getElementById('product-stock').value,
    publishedAt: document.getElementById('product-date').value,
  };
  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    resetProductForm();
    loadProducts();
  } else alert('Ошибка сохранения');
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар?')) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE' });
  loadProducts();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
