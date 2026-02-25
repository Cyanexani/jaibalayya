const API = 'https://fakestoreapi.com';

/* ══════════════════════════════════
   THEME
══════════════════════════════════ */
function getTheme() {
  try { return localStorage.getItem('theme') || 'light'; } catch(e) { return 'light'; }
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch(e) {}
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀' : '☾';
}

// Apply theme immediately to avoid flash
setTheme(getTheme());

/* ══════════════════════════════════
   CART
══════════════════════════════════ */
function getCart() {
  try { return JSON.parse(localStorage.getItem('cart')) || []; } catch(e) { return []; }
}
function saveCart(c) {
  try { localStorage.setItem('cart', JSON.stringify(c)); } catch(e) {}
}
function updateBadge(cart) {
  const b = document.getElementById('cart-count');
  if (!b) return;
  b.textContent = cart.length;
  b.style.display = cart.length ? 'inline-block' : 'none';
}

let cart = getCart();
updateBadge(cart);

/* ══════════════════════════════════
   NAV — THEME TOGGLE (all pages)
══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = getTheme() === 'dark' ? '☀' : '☾';
    btn.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }
});

const path = window.location.pathname;

/* ══════════════════════════════════
   INDEX PAGE
══════════════════════════════════ */
if (!path.includes('product.html') && !path.includes('cart.html') && !path.includes('checkout.html')) {

  fetch(`${API}/products`)
    .then(r => r.json())
    .then(products => {
      document.getElementById('loading-grid').style.display = 'none';
      const grid = document.getElementById('products-grid');
      grid.style.display = 'grid';
      products.forEach(p => {
        const a = document.createElement('a');
        a.className = 'product-card';
        a.href = `product.html?id=${p.id}`;
        a.innerHTML = `
          <div class="card-img-wrap">
            <img src="${p.image}" alt="${p.title}" loading="lazy">
          </div>
          <p class="card-category">${p.category}</p>
          <p class="card-title">${p.title}</p>
          <div class="card-footer">
            <span class="card-price">$${p.price.toFixed(2)}</span>
            <span class="card-arrow">↗</span>
          </div>
        `;
        grid.appendChild(a);
      });
    })
    .catch(() => {
      document.getElementById('loading-grid').innerHTML =
        '<p style="color:var(--text-2);padding:40px 0">Failed to load products. Check your connection.</p>';
    });
}

/* ══════════════════════════════════
   PRODUCT PAGE
══════════════════════════════════ */
if (path.includes('product.html')) {
  const id = new URLSearchParams(window.location.search).get('id');

  fetch(`${API}/products/${id}`)
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(p => {
      document.title = p.title + ' — Store';
      document.getElementById('page-content').innerHTML = `
        <div class="product-wrap">
          <div class="product-img-side">
            <div class="product-img-box">
              <img src="${p.image}" alt="${p.title}">
            </div>
          </div>
          <div class="product-info-side">
            <span class="product-category">${p.category}</span>
            <h1 class="product-title">${p.title}</h1>
            <div class="product-rating">★ ${p.rating.rate} &nbsp;·&nbsp; ${p.rating.count} reviews</div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
            <div class="divider"></div>
            <p class="product-desc">${p.description}</p>
            <button class="add-btn" id="add-btn">Add to Bag</button>
          </div>
        </div>
      `;
      document.getElementById('add-btn').addEventListener('click', () => {
        cart.push({ id: p.id, title: p.title, price: p.price, image: p.image });
        saveCart(cart);
        updateBadge(cart);
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
      });
    })
    .catch(() => {
      document.getElementById('page-content').innerHTML =
        '<p style="padding:80px 48px;color:var(--text-2)">Product not found. <a href="index.html" style="color:var(--text)">Go back</a></p>';
    });
}

/* ══════════════════════════════════
   CART PAGE
══════════════════════════════════ */
if (path.includes('cart.html')) {
  function renderCart() {
    cart = getCart();
    updateBadge(cart);
    const page = document.getElementById('page');
    page.innerHTML = '';

    if (cart.length === 0) {
      page.innerHTML = `
        <div class="empty">
          <div class="empty-icon">◻</div>
          <h2>Your bag is empty</h2>
          <p>Looks like you haven't added anything yet.</p>
          <a href="index.html" class="btn">Browse the shop</a>
        </div>
      `;
      return;
    }

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="cart-header">
        <h1 class="cart-title">Your Bag</h1>
        <span class="cart-count-label">${cart.length} item${cart.length !== 1 ? 's' : ''}</span>
      </div>
    `;

    let total = 0;
    cart.forEach((item, i) => {
      total += item.price;
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="item-img"><img src="${item.image}" alt="${item.title}"></div>
        <div class="item-info">
          <p class="item-title">${item.title}</p>
          <p class="item-price">$${item.price.toFixed(2)}</p>
        </div>
        <button class="remove-btn" data-i="${i}" title="Remove">✕</button>
      `;
      left.appendChild(div);
    });

    left.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        cart.splice(parseInt(e.currentTarget.dataset.i), 1);
        saveCart(cart);
        renderCart();
      });
    });

    const shipping = total > 50 ? 'Free' : '$4.99';
    const finalTotal = total > 50 ? total : total + 4.99;
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.innerHTML = `
      <h3>Order Summary</h3>
      <div class="summary-row"><span>Subtotal</span><span>$${total.toFixed(2)}</span></div>
      <div class="summary-row"><span>Shipping</span><span>${shipping}</span></div>
      <div class="summary-divider"></div>
      <div class="summary-total">
        <span>Total</span>
        <span class="total-price">$${finalTotal.toFixed(2)}</span>
      </div>
      <button class="checkout-btn" id="checkout-btn">Proceed to Checkout</button>
      <a href="index.html" class="continue-link">← Continue shopping</a>
    `;

    page.appendChild(left);
    page.appendChild(summary);

    document.getElementById('checkout-btn').addEventListener('click', () => {
      window.location.href = 'checkout.html';
    });
  }
  renderCart();
}

/* ══════════════════════════════════
   CHECKOUT PAGE
══════════════════════════════════ */
if (path.includes('checkout.html')) {
  cart = getCart();
  updateBadge(cart);

  // Redirect to cart if empty
  if (cart.length === 0) {
    window.location.href = 'cart.html';
  }

  let currentStep = 1; // 1=shipping, 2=payment, 3=review

  function calcTotals() {
    const sub = cart.reduce((s, i) => s + i.price, 0);
    const ship = sub > 50 ? 0 : 4.99;
    return { sub, ship, total: sub + ship };
  }

  function buildSummary() {
    const { sub, ship, total } = calcTotals();
    const items = cart.map(item => `
      <div class="co-item">
        <div class="co-img"><img src="${item.image}" alt="${item.title}"></div>
        <div class="co-info">
          <p class="co-title">${item.title}</p>
          <p class="co-price">$${item.price.toFixed(2)}</p>
        </div>
      </div>
    `).join('');

    return `
      <div class="checkout-summary">
        <h3>Your Order</h3>
        ${items}
        <div class="co-totals">
          <div class="co-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>
          <div class="co-row"><span>Shipping</span><span>${ship === 0 ? 'Free' : '$' + ship.toFixed(2)}</span></div>
          <div class="co-divider"></div>
          <div class="co-total">
            <span>Total</span>
            <span class="co-total-price">$${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function buildSteps(active) {
    const steps = ['Shipping', 'Payment', 'Review'];
    return `
      <div class="steps">
        ${steps.map((s, i) => {
          const n = i + 1;
          const cls = n < active ? 'done' : n === active ? 'active' : '';
          return `
            ${n > 1 ? '<div class="step-line"></div>' : ''}
            <div class="step ${cls}">
              <div class="step-num">${n < active ? '✓' : n}</div>
              <span>${s}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderStep1() {
    document.getElementById('checkout-left').innerHTML = `
      <h1 class="checkout-title">Checkout</h1>
      ${buildSteps(1)}

      <div class="form-section">
        <p class="form-section-title">Contact</p>
        <div class="form-grid full">
          <div class="form-group">
            <label>Email address</label>
            <input type="email" id="email" placeholder="you@example.com">
          </div>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Shipping address</p>
        <div class="form-grid">
          <div class="form-group">
            <label>First name</label>
            <input type="text" id="fname" placeholder="John">
          </div>
          <div class="form-group">
            <label>Last name</label>
            <input type="text" id="lname" placeholder="Doe">
          </div>
        </div>
        <div class="form-grid full" style="margin-top:16px">
          <div class="form-group">
            <label>Address</label>
            <input type="text" id="address" placeholder="123 Main St">
          </div>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <div class="form-group">
            <label>City</label>
            <input type="text" id="city" placeholder="New York">
          </div>
          <div class="form-group">
            <label>Postal code</label>
            <input type="text" id="zip" placeholder="10001">
          </div>
        </div>
        <div class="form-grid full" style="margin-top:16px">
          <div class="form-group">
            <label>Country</label>
            <select id="country">
              <option value="">Select country</option>
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Canada</option>
              <option>Australia</option>
              <option>Germany</option>
              <option>France</option>
              <option>India</option>
              <option>Japan</option>
            </select>
          </div>
        </div>
      </div>

      <button class="place-order-btn" id="next-btn">Continue to Payment &nbsp;→</button>
    `;

    document.getElementById('next-btn').addEventListener('click', () => {
      const email = document.getElementById('email').value.trim();
      const fname = document.getElementById('fname').value.trim();
      const addr  = document.getElementById('address').value.trim();
      if (!email || !fname || !addr) {
        showToast('Please fill in all required fields');
        return;
      }
      currentStep = 2;
      renderStep2();
    });
  }

  function renderStep2() {
    document.getElementById('checkout-left').innerHTML = `
      <h1 class="checkout-title">Checkout</h1>
      ${buildSteps(2)}

      <div class="form-section">
        <p class="form-section-title">Payment method</p>
        <div class="payment-methods">
          <div class="pay-icon active" data-method="card">💳 Card</div>
          <div class="pay-icon" data-method="paypal">🅿 PayPal</div>
          <div class="pay-icon" data-method="apple">  Apple Pay</div>
        </div>

        <div id="card-fields">
          <div class="form-grid full">
            <div class="form-group">
              <label>Card number</label>
              <input type="text" id="card-num" placeholder="1234 5678 9012 3456" maxlength="19">
            </div>
          </div>
          <div class="form-grid" style="margin-top:16px">
            <div class="form-group">
              <label>Expiry</label>
              <input type="text" id="expiry" placeholder="MM / YY" maxlength="7">
            </div>
            <div class="form-group">
              <label>CVV</label>
              <input type="text" id="cvv" placeholder="123" maxlength="4">
            </div>
          </div>
          <div class="form-grid full" style="margin-top:16px">
            <div class="form-group">
              <label>Name on card</label>
              <input type="text" id="card-name" placeholder="John Doe">
            </div>
          </div>
        </div>
      </div>

      <button class="place-order-btn" id="next-btn">Review Order &nbsp;→</button>
    `;

    // Payment method switching
    document.querySelectorAll('.pay-icon').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.pay-icon').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        const cf = document.getElementById('card-fields');
        cf.style.display = el.dataset.method === 'card' ? 'block' : 'none';
      });
    });

    // Card number formatting
    const cardNum = document.getElementById('card-num');
    if (cardNum) {
      cardNum.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 16);
        e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
      });
    }
    const expiry = document.getElementById('expiry');
    if (expiry) {
      expiry.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 2) v = v.substring(0,2) + ' / ' + v.substring(2);
        e.target.value = v;
      });
    }

    document.getElementById('next-btn').addEventListener('click', () => {
      currentStep = 3;
      renderStep3();
    });
  }

  function renderStep3() {
    const { sub, ship, total } = calcTotals();
    document.getElementById('checkout-left').innerHTML = `
      <h1 class="checkout-title">Checkout</h1>
      ${buildSteps(3)}

      <div class="form-section">
        <p class="form-section-title">Review your order</p>
        <p style="font-size:0.9rem;color:var(--text-2);line-height:1.7;margin-bottom:24px">
          Please confirm everything looks correct before placing your order.
          By clicking "Place Order" you agree to our terms of service.
        </p>

        <div style="background:var(--bg-2);border-radius:16px;padding:24px;margin-bottom:24px;transition:background 0.3s">
          <p style="font-size:0.7rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-2);margin-bottom:16px">Order summary</p>
          ${cart.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:0.88rem;color:var(--text);max-width:260px">${i.title}</span>
              <span style="font-size:0.88rem;font-weight:500;color:var(--text);flex-shrink:0;margin-left:12px">$${i.price.toFixed(2)}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding:16px 0 0">
            <span style="font-size:0.9rem;font-weight:500">Total</span>
            <span style="font-family:'DM Serif Display',serif;font-size:1.3rem;letter-spacing:-0.02em">$${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button class="place-order-btn" id="place-btn">Place Order &nbsp;✓</button>
    `;

    document.getElementById('place-btn').addEventListener('click', () => {
      saveCart([]);
      updateBadge([]);
      showSuccess();
    });
  }

  function showSuccess() {
    document.getElementById('checkout-left').innerHTML = `
      <div class="order-success">
        <div class="success-icon">✓</div>
        <h2>Order placed!</h2>
        <p>Thank you for your order. You'll receive a confirmation shortly. We'll notify you when your items ship.</p>
        <a href="index.html" class="btn">Back to shop</a>
      </div>
    `;
    document.getElementById('checkout-right').innerHTML = '';
  }

  function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // Init
  document.getElementById('checkout-right').innerHTML = buildSummary();
  renderStep1();
}
