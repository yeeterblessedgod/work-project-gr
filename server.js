/**
 * ============================================================================
 *  СЕРВЕР YourProjectName — ВАРИАНТ GR (зелёная тема, другой каталог)
 *  Запуск: npm install  →  npm start  →  http://localhost:3001
 *
 *  РОЛИ (иерархия прав):
 *    guest   — только просмотр каталога
 *    user    — каталог + корзина
 *    manager — каталог + управление товарами + базовая сортировка
 *    admin   — всё + расширенная сортировка + заказы + админ-панель
 *
 *  ТЕСТОВЫЕ АККАУНТЫ (измените под своё ТЗ на экзамене):
 *    user / user123       → Пользователь
 *    manager / manager123 → Менеджер
 *    admin / admin123     → Админ
 * ============================================================================
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Пути к JSON-файлам (хранилище данных; на экзамене можно заменить на MySQL) ---
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// --- Временное хранилище капчи (сессия + ответ) ---
const captchaStore = new Map();

// ============================================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РАБОТЫ С JSON
// ============================================================================

function readJson(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(items) {
  return items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

// ============================================================================
//  MIDDLEWARE
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'yourprojectname-gr-secret-change-on-exam',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Статика: HTML, CSS, JS из папки public/
app.use(express.static(path.join(__dirname, 'public')));

/** Текущий пользователь из сессии (или null) */
function getSessionUser(req) {
  return req.session.user || null;
}

/** Проверка минимальной роли */
function hasRole(user, minRole) {
  const order = ['guest', 'user', 'manager', 'admin'];
  if (!user) return minRole === 'guest';
  return order.indexOf(user.role) >= order.indexOf(minRole);
}

function requireRole(minRole) {
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!hasRole(user, minRole)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

// Редирект с главной на страницу входа
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============================================================================
//  КАПЧА (простая математическая — работает без интернета)
// ============================================================================

/** GET /api/captcha — получить новую задачу */
app.get('/api/captcha', (req, res) => {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  captchaStore.set(token, { answer: a + b, expires: Date.now() + 5 * 60 * 1000 });
  res.json({ token, question: `${a} + ${b} = ?` });
});

function verifyCaptcha(token, answer) {
  const record = captchaStore.get(token);
  if (!record || record.expires < Date.now()) return false;
  captchaStore.delete(token);
  return String(record.answer) === String(answer).trim();
}

// ============================================================================
//  АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ
// ============================================================================

/** POST /login — вход по логину и паролю */
app.post('/login', (req, res) => {
  const { login, password, captcha_token, captcha_answer } = req.body;

  if (!verifyCaptcha(captcha_token, captcha_answer)) {
    return res.status(400).send('Неверная капча. Обновите задачу и попробуйте снова.');
  }

  const users = readJson(USERS_FILE);
  const found = users.find((u) => u.login === login && u.password === password);
  if (!found) {
    return res.status(401).send('Неверный логин или пароль');
  }

  req.session.user = {
    id: found.id,
    login: found.login,
    fullName: found.fullName,
    role: found.role,
  };
  res.redirect('/catalog.html');
});

/** POST /register — регистрация нового пользователя (роль user) */
app.post('/register', (req, res) => {
  const { login, password, fullName, email, captcha_token, captcha_answer } = req.body;

  if (!verifyCaptcha(captcha_token, captcha_answer)) {
    return res.status(400).send('Неверная капча');
  }

  const users = readJson(USERS_FILE);
  if (users.some((u) => u.login === login)) {
    return res.status(400).send('Такой логин уже занят');
  }

  const newUser = {
    id: nextId(users),
    login,
    password,
    fullName: fullName || login,
    email: email || '',
    role: 'user',
  };
  users.push(newUser);
  writeJson(USERS_FILE, users);
  res.redirect('/login.html?registered=1');
});

/** POST /guest — вход как гость (роль guest) */
app.post('/guest', (req, res) => {
  req.session.user = {
    id: 0,
    login: 'guest',
    fullName: 'Гость',
    role: 'guest',
  };
  res.redirect('/catalog.html');
});

/** POST /logout — выход */
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

/** GET /api/me — данные текущей сессии (для catalog.js / admin.js) */
app.get('/api/me', (req, res) => {
  res.json({ user: getSessionUser(req) });
});

// ============================================================================
//  ТОВАРЫ И КАТАЛОГ
// ============================================================================

/**
 * GET /api/products
 * Параметры сортировки:
 *   sortBy  — name | price | publishedAt | category | stock (расширенная для admin)
 *   order   — asc | desc
 */
app.get('/api/products', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Войдите в систему' });

  let products = readJson(PRODUCTS_FILE);
  const { sortBy = 'name', order = 'asc' } = req.query;
  const allowedBasic = ['name', 'price', 'publishedAt'];
  const allowedExtended = [...allowedBasic, 'category', 'stock'];

  let allowed = allowedBasic;
  if (user.role === 'admin') allowed = allowedExtended;
  else if (user.role === 'manager') allowed = allowedBasic;

  const field = allowed.includes(sortBy) ? sortBy : 'name';
  const dir = order === 'desc' ? -1 : 1;

  products.sort((a, b) => {
    let va = a[field];
    let vb = b[field];
    if (field === 'price' || field === 'stock') {
      return (Number(va) - Number(vb)) * dir;
    }
    if (field === 'publishedAt') {
      return (new Date(va) - new Date(vb)) * dir;
    }
    return String(va).localeCompare(String(vb), 'ru') * dir;
  });

  res.json({ products, role: user.role });
});

/** POST /api/products — создать товар (manager, admin) */
app.post('/api/products', requireRole('manager'), (req, res) => {
  const products = readJson(PRODUCTS_FILE);
  const { name, description, price, category, stock, publishedAt } = req.body;
  const item = {
    id: nextId(products),
    name,
    description: description || '',
    price: Number(price) || 0,
    category: category || 'прочее',
    stock: Number(stock) || 0,
    publishedAt: publishedAt || new Date().toISOString().slice(0, 10),
  };
  products.push(item);
  writeJson(PRODUCTS_FILE, products);
  res.json({ ok: true, product: item });
});

/** PUT /api/products/:id — изменить товар */
app.put('/api/products/:id', requireRole('manager'), (req, res) => {
  const products = readJson(PRODUCTS_FILE);
  const id = Number(req.params.id);
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Товар не найден' });
  products[idx] = { ...products[idx], ...req.body, id };
  writeJson(PRODUCTS_FILE, products);
  res.json({ ok: true, product: products[idx] });
});

/** DELETE /api/products/:id — удалить товар */
app.delete('/api/products/:id', requireRole('manager'), (req, res) => {
  let products = readJson(PRODUCTS_FILE);
  const id = Number(req.params.id);
  products = products.filter((p) => p.id !== id);
  writeJson(PRODUCTS_FILE, products);
  res.json({ ok: true });
});

// ============================================================================
//  КОРЗИНА (только user и выше; guest — нет доступа)
// ============================================================================

app.get('/api/cart', requireRole('user'), (req, res) => {
  res.json({ cart: req.session.cart || [] });
});

app.post('/api/cart/add', requireRole('user'), (req, res) => {
  const { productId, qty = 1 } = req.body;
  const products = readJson(PRODUCTS_FILE);
  const product = products.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  if (!req.session.cart) req.session.cart = [];
  const existing = req.session.cart.find((c) => c.productId === product.id);
  if (existing) existing.qty += Number(qty);
  else {
    req.session.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: Number(qty),
    });
  }
  res.json({ ok: true, cart: req.session.cart });
});

/** POST /api/cart/checkout — оформить заказ */
app.post('/api/cart/checkout', requireRole('user'), (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.status(400).json({ error: 'Корзина пуста' });

  const orders = readJson(ORDERS_FILE);
  const user = getSessionUser(req);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    id: nextId(orders),
    userId: user.id,
    userLogin: user.login,
    items: cart,
    total,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  writeJson(ORDERS_FILE, orders);
  req.session.cart = [];
  res.json({ ok: true, order });
});

// ============================================================================
//  АДМИН-ПАНЕЛЬ API
// ============================================================================

/** GET /api/admin/users — список пользователей (admin) */
app.get('/api/admin/users', requireRole('admin'), (req, res) => {
  const users = readJson(USERS_FILE).map(({ password, ...rest }) => rest);
  res.json({ users });
});

/** PUT /api/admin/users/:id — изменить роль пользователя */
app.put('/api/admin/users/:id', requireRole('admin'), (req, res) => {
  const users = readJson(USERS_FILE);
  const id = Number(req.params.id);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Не найден' });
  const allowedRoles = ['user', 'manager', 'admin'];
  if (req.body.role && allowedRoles.includes(req.body.role)) {
    users[idx].role = req.body.role;
  }
  writeJson(USERS_FILE, users);
  res.json({ ok: true, user: { id: users[idx].id, login: users[idx].login, role: users[idx].role } });
});

/** GET /api/admin/orders — все заказы */
app.get('/api/admin/orders', requireRole('admin'), (req, res) => {
  res.json({ orders: readJson(ORDERS_FILE) });
});

/** PUT /api/admin/orders/:id — сменить статус заказа */
app.put('/api/admin/orders/:id', requireRole('admin'), (req, res) => {
  const orders = readJson(ORDERS_FILE);
  const id = Number(req.params.id);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Заказ не найден' });
  if (req.body.status) orders[idx].status = req.body.status;
  writeJson(ORDERS_FILE, orders);
  res.json({ ok: true, order: orders[idx] });
});

// ============================================================================
//  ЗАПУСК
// ============================================================================

app.listen(PORT, () => {
  console.log(`YourProjectName [GR]: http://localhost:${PORT}`);
  console.log('Тест: user/user123, manager/manager123, admin/admin123');
});
