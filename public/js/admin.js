/**
 * ============================================================================
 *  admin.js — админ-панель YourProjectName (роль admin)
 *  Вкладки: список пользователей | товары | пользователи + заказы
 * ============================================================================
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/me');
  const data = await res.json();
  currentUser = data.user;

  if (!currentUser || currentUser.role !== 'admin') {
    alert('Доступ только для администратора');
    window.location.href = '/catalog.html';
    return;
  }

  initTabs();
  await loadUsersList();
  await loadAdminProducts();
  await loadUsersManage();
  await loadOrders();
});

/** Переключение вкладок */
function initTabs() {
  const buttons = document.querySelectorAll('#admin-tabs button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('hidden'));
      const tabId = 'tab-' + btn.dataset.tab;
      document.getElementById(tabId)?.classList.remove('hidden');
    });
  });

  document.getElementById('admin-refresh-products')?.addEventListener('click', loadAdminProducts);
  document.getElementById('admin-sort-by')?.addEventListener('change', loadAdminProducts);
  document.getElementById('admin-sort-order')?.addEventListener('change', loadAdminProducts);
  document.getElementById('admin-product-form')?.addEventListener('submit', saveAdminProduct);
}

/** Вкладка 1: список пользователей (только просмотр) */
async function loadUsersList() {
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  const tbody = document.getElementById('users-list-body');
  if (!tbody) return;
  tbody.innerHTML = data.users
    .map(
      (u) => `
    <tr>
      <td>${u.id}</td>
      <td>${u.login}</td>
      <td>${u.fullName || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${u.role}</td>
    </tr>
  `
    )
    .join('');
}

/** Вкладка 2: товары */
async function loadAdminProducts() {
  const sortBy = document.getElementById('admin-sort-by')?.value || 'name';
  const order = document.getElementById('admin-sort-order')?.value || 'asc';
  const res = await fetch(`/api/products?sortBy=${sortBy}&order=${order}`);
  const data = await res.json();
  const tbody = document.getElementById('admin-products-body');
  if (!tbody) return;
  tbody.innerHTML = data.products
    .map(
      (p) => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.price} ₽</td>
      <td>${p.category}</td>
      <td>${p.stock}</td>
      <td>${p.publishedAt}</td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" data-edit="${p.id}">Изменить</button>
        <button type="button" class="btn btn-danger btn-sm" data-del="${p.id}">Удалить</button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = data.products.find((x) => x.id === Number(btn.dataset.edit));
      if (!p) return;
      document.getElementById('admin-product-id').value = p.id;
      document.getElementById('admin-product-name').value = p.name;
      document.getElementById('admin-product-price').value = p.price;
      document.getElementById('admin-product-category').value = p.category;
      document.getElementById('admin-product-stock').value = p.stock;
    });
  });
  tbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить?')) return;
      await fetch(`/api/products/${btn.dataset.del}`, { method: 'DELETE' });
      loadAdminProducts();
    });
  });
}

async function saveAdminProduct(e) {
  e.preventDefault();
  const id = document.getElementById('admin-product-id').value;
  const body = {
    name: document.getElementById('admin-product-name').value,
    price: Number(document.getElementById('admin-product-price').value),
    category: document.getElementById('admin-product-category').value,
    stock: Number(document.getElementById('admin-product-stock').value),
    description: '',
    publishedAt: new Date().toISOString().slice(0, 10),
  };
  const url = id ? `/api/products/${id}` : '/api/products';
  await fetch(url, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  document.getElementById('admin-product-form').reset();
  document.getElementById('admin-product-id').value = '';
  loadAdminProducts();
}

/** Вкладка 3: смена ролей */
async function loadUsersManage() {
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  const tbody = document.getElementById('users-manage-body');
  if (!tbody) return;
  tbody.innerHTML = data.users
    .map(
      (u) => `
    <tr>
      <td>${u.login}</td>
      <td>${u.fullName || '—'}</td>
      <td>${u.role}</td>
      <td>
        <select data-user-id="${u.id}" class="role-select">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>manager</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
      <td><button type="button" class="btn btn-primary btn-sm" data-save-role="${u.id}">Сохранить</button></td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-save-role]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveRole;
      const select = tbody.querySelector(`select[data-user-id="${id}"]`);
      await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: select.value }),
      });
      alert('Роль обновлена');
      loadUsersList();
      loadUsersManage();
    });
  });
}

/** Заказы пользователей */
async function loadOrders() {
  const res = await fetch('/api/admin/orders');
  const data = await res.json();
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = data.orders
    .map(
      (o) => `
    <tr>
      <td>${o.id}</td>
      <td>${o.userLogin}</td>
      <td>${o.total} ₽</td>
      <td>
        <select data-order-id="${o.id}" class="order-status">
          <option value="new" ${o.status === 'new' ? 'selected' : ''}>new</option>
          <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>processing</option>
          <option value="done" ${o.status === 'done' ? 'selected' : ''}>done</option>
        </select>
      </td>
      <td>${new Date(o.createdAt).toLocaleString('ru')}</td>
      <td><button type="button" class="btn btn-primary btn-sm" data-save-order="${o.id}">Сохранить</button></td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-save-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.saveOrder;
      const select = tbody.querySelector(`select[data-order-id="${id}"]`);
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: select.value }),
      });
      alert('Статус заказа обновлён');
    });
  });
}
