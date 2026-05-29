import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Coffee, ShoppingBag, Package, ArrowLeft, CreditCard, Save } from "lucide-react";
import { supabase } from "./supabaseClient";
import "./style.css";

const TABLES = [
  "Masa 1", "Masa 2", "Masa 3", "Masa 4",
  "Masa 5", "Masa 6", "Paket", "Gel Al"
];

const normalizeTableName = value => value?.trim().toLowerCase();

const formatPrice = value => `${Number(value || 0)} ₺`;

function App() {
  const [screen, setScreen] = useState("tables");
  const [selectedTable, setSelectedTable] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("Tümü");

  const [openOrders, setOpenOrders] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState(null);

  useEffect(() => {
  loadProducts();
  loadOpenOrders();
}, []);

  useEffect(() => {
  const channel = supabase
    .channel("orders-status")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => loadOpenOrders()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Ürünler alınamadı.");
    return;
  }

  setProducts(data || []);
}

async function loadOpenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending");

  if (error) {
    console.error(error);
    return;
  }

  setOpenOrders(data || []);
}

async function findPendingOrderByTable(tableName) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending");

  if (error) {
    console.error(error);
    return null;
  }

  const orders = data || [];
  setOpenOrders(orders);

  return orders.find(
    order => normalizeTableName(order.table_name) === normalizeTableName(tableName)
  ) || null;
}

async function clearOrder(orderId) {
  const { error: itemsError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (itemsError) {
    console.error(itemsError);
    setStatus("Siparis urunleri silinemedi.");
    return false;
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total_price: 0,
      paid: false,
      status: "cancelled"
    })
    .eq("id", orderId);

  if (orderError) {
    console.error(orderError);
    setStatus("Siparis kapatilamadi.");
    return false;
  }

  return true;
}

  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ["Tümü", ...list];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (category === "Tümü") return products;
    return products.filter(p => p.category === category);
  }, [products, category]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const pendingOrdersByTable = useMemo(() => {
    return openOrders.reduce((ordersByTable, order) => {
      ordersByTable[normalizeTableName(order.table_name)] = order;
      return ordersByTable;
    }, {});
  }, [openOrders]);

  async function openOrder(tableName) {
  setSelectedTable(tableName);
  setStatus("");

  const existingOrder = await findPendingOrderByTable(tableName);

  if (!existingOrder) {
    setCurrentOrderId(null);
    setCart({});
    setScreen("order");
    return;
  }

  const { data: items, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", existingOrder.id);

  if (error) {
    console.error(error);
    return;
  }

  const restoredCart = {};

  items.forEach(item => {
    restoredCart[item.product_name] = {
      name: item.product_name,
      price: Number(item.unit_price),
      quantity: item.quantity,
      product: {
        name: item.product_name,
        price: item.unit_price
      }
    };
  });

  setCurrentOrderId(existingOrder.id);
  setCart(restoredCart);
  setScreen("order");
}

  function addProduct(product) {
    setCart(prev => {
      const current = prev[product.name];
      return {
        ...prev,
        [product.name]: {
          product,
          name: product.name,
          price: Number(product.price || 0),
          quantity: current ? current.quantity + 1 : 1
        }
      };
    });
  }

  function removeProduct(product) {
    setCart(prev => {
      const current = prev[product.name];
      if (!current) return prev;
      const next = { ...prev };
      if (current.quantity <= 1) delete next[product.name];
      else next[product.name] = { ...current, quantity: current.quantity - 1 };
      return next;
    });
  }

  async function saveOrder(markPaid = false) {
  if (!selectedTable) {
    setStatus("Önce masa ve ürün seç.");
    return;
  }

  setStatus("Kaydediliyor...");

  let orderId = currentOrderId;
  let orderWasPending = Boolean(orderId);

  if (cartItems.length === 0) {
    if (!orderId) {
      const existingOrder = await findPendingOrderByTable(selectedTable);
      orderId = existingOrder?.id;
    }

    if (!orderId) {
      setStatus("Once masa ve urun sec.");
      return;
    }

    const cleared = await clearOrder(orderId);

    if (!cleared) return;

    setCart({});
    setCurrentOrderId(null);
    setSelectedTable(null);
    setStatus("");
    await loadOpenOrders();
    setScreen("tables");
    return;
  }

  if (!orderId) {
    const existingOrder = await findPendingOrderByTable(selectedTable);

    if (existingOrder) {
      orderId = existingOrder.id;
      orderWasPending = true;
      setCurrentOrderId(orderId);
    }
  }

  if (!orderId) {
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        table_name: selectedTable,
        total_price: total,
        paid: markPaid,
        status: markPaid ? "completed" : "pending"
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);
      setStatus("Sipariş kaydedilemedi.");
      return;
    }

    orderId = newOrder.id;
    setCurrentOrderId(orderId);
  } else {
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        total_price: total,
        paid: markPaid,
        status: markPaid ? "completed" : "pending"
      })
      .eq("id", orderId);

    if (updateError) {
      console.error(updateError);
      setStatus("Sipariş güncellenemedi.");
      return;
    }
  }

  if (orderWasPending) {
    await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);
  }

  const rows = cartItems.map(item => ({
    order_id: orderId,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(rows);

  if (itemsError) {
    console.error(itemsError);
    setStatus("Sipariş ürünleri kaydedilemedi.");
    return;
  }

  if (markPaid) {
    for (const item of cartItems) {
      const newStock = Number(item.product.stock || 0) - item.quantity;

      await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("name", item.name);

      await supabase
        .from("stock_movements")
        .insert({
          product_name: item.name,
          movement_type: "sale",
          quantity: -item.quantity,
          note: `${selectedTable} satışı`
        });
    }

    setCart({});
    setCurrentOrderId(null);

    await loadProducts();
  }

  setStatus(
    markPaid
      ? "Ödeme alındı. Sipariş tamamlandı."
      : "Sipariş kaydedildi."
  );

  await loadOpenOrders();
}

  if (screen === "tables") {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <h1>Saray Kafe Panel</h1>
            <p>Tablet sipariş sistemi</p>
          </div>
          <Coffee size={34} />
        </header>

        <section className="table-grid">
          {TABLES.map(t => {
            const pendingOrder = pendingOrdersByTable[normalizeTableName(t)];
            const isOpen = Boolean(pendingOrder);
            const emptyClass = t.includes("Paket")
              ? "purple"
              : t.includes("Gel")
                ? "green"
                : "empty";

            return (
              <button key={t} className={`table-card ${isOpen ? "open" : emptyClass}`} onClick={() => openOrder(t)}>
              {t.includes("Paket") ? <Package /> : t.includes("Gel") ? <ShoppingBag /> : <Coffee />}
                <strong>{t}</strong>
                <span>{isOpen ? "Açık Hesap" : "Boş Masa"}</span>
                {isOpen && <b className="table-total">{formatPrice(pendingOrder.total_price)}</b>}
              </button>
            );
          })}
        </section>

        <section className="stats">
          <div><b>{products.length}</b><span>Ürün</span></div>
          <div><b>{products.filter(p => Number(p.stock) <= 5).length}</b><span>Kritik Stok</span></div>
          <div><b>Hazır</b><span>Sistem</span></div>
        </section>
      </div>
    );
  }

  return (
    <div className="app order-layout">
      <header className="topbar">
        <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
        <div>
          <h1>{selectedTable}</h1>
          <p>Sipariş oluştur</p>
        </div>
      </header>

      <div className="category-row">
        {categories.map(c => (
          <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <main className="order-main">
        <section className="products">
          {filteredProducts.map(product => {
            const qty = cart[product.name]?.quantity || 0;
            return (
              <div className="product-card" key={product.name}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.category}</span>
                  <b>{Number(product.price || 0)} ₺</b>
                </div>
                <div className="counter">
                  <button onClick={() => removeProduct(product)}>-</button>
                  <em>{qty}</em>
                  <button onClick={() => addProduct(product)}>+</button>
                </div>
              </div>
            );
          })}
        </section>

        <aside className="cart">
          <h2>Adisyon</h2>

          {cartItems.length === 0 && <p className="empty">Henüz ürün yok.</p>}

          {cartItems.map(item => (
            <div className="cart-line" key={item.name}>
              <span>{item.name}<small>{item.quantity} x {item.price} ₺</small></span>
              <b>{item.quantity * item.price} ₺</b>
            </div>
          ))}

          <div className="total">
            <span>Toplam</span>
            <strong>{total} ₺</strong>
          </div>

          {status && <p className="status">{status}</p>}

          <button className="save" onClick={() => saveOrder(false)}>
            <Save size={18} /> Siparişi Kaydet
          </button>

          <button className="pay" onClick={() => saveOrder(true)}>
            <CreditCard size={18} /> Ödeme Al
          </button>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
