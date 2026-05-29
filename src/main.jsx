import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Coffee, ShoppingBag, Package, ArrowLeft, CreditCard, Save, Search, ClipboardList, ArrowRightLeft, BarChart3 } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("Tümü");

  const [openOrders, setOpenOrders] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [isCurrentOrderPending, setIsCurrentOrderPending] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

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
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const categoryProducts = category === "Tümü"
      ? products
      : products.filter(product => product.category === category);

    if (!normalizedSearch) return categoryProducts;

    return categoryProducts.filter(product =>
      product.name?.toLowerCase().includes(normalizedSearch) ||
      product.category?.toLowerCase().includes(normalizedSearch)
    );
  }, [products, category, searchTerm]);

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

  const emptyTransferTargets = useMemo(() => {
    return TABLES.filter(tableName =>
      normalizeTableName(tableName) !== normalizeTableName(selectedTable) &&
      !pendingOrdersByTable[normalizeTableName(tableName)]
    );
  }, [pendingOrdersByTable, selectedTable]);

  const productCategoriesByName = useMemo(() => {
    return products.reduce((categoriesByName, product) => {
      categoriesByName[product.name] = product.category || "Diğer";
      return categoriesByName;
    }, {});
  }, [products]);

  function getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: start.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      })
    };
  }

  async function loadEndOfDayReport() {
  setReportLoading(true);
  setStatus("");

  const today = getTodayRange();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,total_price,created_at")
    .eq("status", "completed")
    .eq("paid", true)
    .gte("created_at", today.start)
    .lt("created_at", today.end);

  if (ordersError) {
    console.error(ordersError);
    setStatus("Gün sonu raporu alınamadı.");
    setReportLoading(false);
    return;
  }

  const completedOrders = orders || [];
  const orderIds = completedOrders.map(order => order.id);
  let items = [];

  if (orderIds.length > 0) {
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name,quantity,total_price,unit_price,order_id")
      .in("order_id", orderIds);

    if (itemsError) {
      console.error(itemsError);
      setStatus("Gün sonu ürünleri alınamadı.");
      setReportLoading(false);
      return;
    }

    items = orderItems || [];
  }

  const productSales = {};
  const categorySales = {};
  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.total_price || 0),
    0
  );
  const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  items.forEach(item => {
    const productName = item.product_name || "Bilinmeyen Ürün";
    const quantity = Number(item.quantity || 0);
    const itemTotal = Number(item.total_price || 0);
    const category = productCategoriesByName[productName] || "Diğer";

    if (!productSales[productName]) {
      productSales[productName] = {
        name: productName,
        quantity: 0,
        total: 0
      };
    }

    productSales[productName].quantity += quantity;
    productSales[productName].total += itemTotal;
    categorySales[category] = (categorySales[category] || 0) + itemTotal;
  });

  setReport({
    dateLabel: today.label,
    totalRevenue,
    completedOrderCount: completedOrders.length,
    totalItems,
    topProducts: Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, 5),
    categoryTotals: Object.entries(categorySales)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  });
  setReportLoading(false);
}

  async function openOrder(tableName) {
  setSelectedTable(tableName);
  setStatus("");
  setSearchTerm("");
  setTransferMode(false);
  setMobileCartOpen(false);

  const existingOrder = await findPendingOrderByTable(tableName);

  if (!existingOrder) {
    setCurrentOrderId(null);
    setIsCurrentOrderPending(false);
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
  setIsCurrentOrderPending(existingOrder.status === "pending");
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

  async function transferOrder(targetTable) {
  if (!currentOrderId || !isCurrentOrderPending) {
    setStatus("Sadece açık hesaplar transfer edilebilir.");
    return;
  }

  if (normalizeTableName(targetTable) === normalizeTableName(selectedTable)) {
    setStatus("Aynı masaya transfer yapılamaz.");
    return;
  }

  setStatus("Masa transfer ediliyor...");

  const targetOrder = await findPendingOrderByTable(targetTable);

  if (targetOrder) {
    setStatus("Hedef masada zaten açık hesap var.");
    return;
  }

  const { data: transferredOrder, error } = await supabase
    .from("orders")
    .update({ table_name: targetTable })
    .eq("id", currentOrderId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) {
    console.error(error);
    setStatus(error.code === "PGRST116" ? "Bu hesap artık transfer edilemez." : "Masa transferi tamamlanamadı.");
    return;
  }

  if (!transferredOrder) {
    setStatus("Bu hesap artık transfer edilemez.");
    return;
  }

  setCart({});
  setCurrentOrderId(null);
  setIsCurrentOrderPending(false);
  setSelectedTable(null);
  setTransferMode(false);
  setMobileCartOpen(false);
  setStatus("");
  await loadOpenOrders();
  setScreen("tables");
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
    setIsCurrentOrderPending(false);
    setSelectedTable(null);
    setTransferMode(false);
    setMobileCartOpen(false);
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
      setIsCurrentOrderPending(existingOrder.status === "pending");
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
    setIsCurrentOrderPending(newOrder.status === "pending");
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
    setIsCurrentOrderPending(false);
    setTransferMode(false);
    setMobileCartOpen(false);

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
            <h1>Saray Kafe Yönetim Paneli</h1>
            <p>Masa, paket ve gel-al sipariş takibi</p>
          </div>
          <div className="topbar-actions">
            <button className="report-button" onClick={loadEndOfDayReport} disabled={reportLoading}>
              <BarChart3 size={18} /> {reportLoading ? "Hazırlanıyor" : "Gün Sonu Raporu"}
            </button>
            <ClipboardList size={34} />
          </div>
        </header>

        <section className="table-grid">
          {TABLES.map(t => {
            const pendingOrder = pendingOrdersByTable[normalizeTableName(t)];
            const isOpen = Boolean(pendingOrder);
            const emptyClass = t.includes("Paket")
              ? "purple"
              : t.includes("Gel")
                ? "teal"
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

        {report && (
          <section className="report-panel">
            <div className="report-head">
              <div>
                <h2>Gün Sonu Raporu</h2>
                <p>{report.dateLabel}</p>
              </div>
              <button onClick={() => setReport(null)}>Kapat</button>
            </div>

            <div className="report-summary">
              <div>
                <span>Toplam Ciro</span>
                <strong>{formatPrice(report.totalRevenue)}</strong>
              </div>
              <div>
                <span>Tamamlanan Sipariş</span>
                <strong>{report.completedOrderCount}</strong>
              </div>
              <div>
                <span>Satılan Ürün</span>
                <strong>{report.totalItems}</strong>
              </div>
            </div>

            <div className="report-lists">
              <div>
                <h3>En Çok Satan Ürünler</h3>
                {report.topProducts.length === 0 && <p className="empty">Bugün tamamlanan satış yok.</p>}
                {report.topProducts.map(product => (
                  <div className="report-line" key={product.name}>
                    <span>{product.name}<small>{product.quantity} adet</small></span>
                    <b>{formatPrice(product.total)}</b>
                  </div>
                ))}
              </div>

              <div>
                <h3>Kategori Bazlı Satış</h3>
                {report.categoryTotals.length === 0 && <p className="empty">Kategori satışı yok.</p>}
                {report.categoryTotals.map(categoryTotal => (
                  <div className="report-line" key={categoryTotal.name}>
                    <span>{categoryTotal.name}</span>
                    <b>{formatPrice(categoryTotal.total)}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="app order-layout">
      <header className="topbar">
        <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
        <div>
          <h1>{selectedTable}</h1>
          <p>Adisyon yönetimi</p>
        </div>
      </header>

      <div className="order-tools">
        <label className="search-box">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Ürün ara"
          />
        </label>
      </div>

      <div className="category-row">
        {categories.map(c => (
          <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <main className="order-main">
        <section className="products">
          {filteredProducts.length === 0 && <p className="empty products-empty">Ürün bulunamadı.</p>}

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

        {mobileCartOpen && <button className="mobile-cart-backdrop" onClick={() => setMobileCartOpen(false)} aria-label="Adisyonu kapat" />}

        <aside className={`cart ${mobileCartOpen ? "mobile-open" : ""}`}>
          <div className="cart-head">
            <h2>Adisyon</h2>
            <button className="cart-close" onClick={() => setMobileCartOpen(false)}>Kapat</button>
          </div>

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

          {isCurrentOrderPending && currentOrderId && (
            <div className="transfer-panel">
              <button className="transfer" onClick={() => setTransferMode(prev => !prev)}>
                <ArrowRightLeft size={18} /> Masa Transferi
              </button>

              {transferMode && (
                <div className="transfer-targets">
                  <span>Boş masa seç</span>

                  {emptyTransferTargets.length === 0 && (
                    <p className="empty">Transfer edilecek boş masa yok.</p>
                  )}

                  {emptyTransferTargets.map(tableName => (
                    <button key={tableName} onClick={() => transferOrder(tableName)}>
                      {tableName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="save" onClick={() => saveOrder(false)}>
            <Save size={18} /> Siparişi Kaydet
          </button>

          <button className="pay" onClick={() => saveOrder(true)}>
            <CreditCard size={18} /> Ödeme Al
          </button>
        </aside>
      </main>

      <div className="mobile-cart-bar">
        <div>
          <span>Toplam</span>
          <strong>{total} ₺</strong>
        </div>
        <button onClick={() => setMobileCartOpen(true)}>Adisyonu Aç</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
