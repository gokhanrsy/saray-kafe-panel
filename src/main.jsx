import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Coffee, ShoppingBag, Package, ArrowLeft, CreditCard, Save, Search, ClipboardList, ArrowRightLeft, BarChart3, Boxes } from "lucide-react";
import { supabase } from "./supabaseClient";
import "./style.css";

const TABLES = [
  "Masa 1", "Masa 2", "Masa 3", "Masa 4",
  "Masa 5", "Masa 6", "Masa 7", "Masa 8",
  "Masa 9", "Masa 10", "Masa 11", "Masa 12",
  "Masa 13", "Paket", "Gel Al"
];

const QUICK_PRODUCT_NAMES = ["Çay", "Su", "Latte", "Türk Kahvesi", "Kola", "Börek"];

const normalizeTableName = value => value?.trim().toLowerCase();

const formatPrice = value => `${Number(value || 0)} ₺`;

function App() {
  const panelPassword = import.meta.env.VITE_PANEL_PASSWORD || "1234";
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem("saray-panel-auth") === "true"
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [screen, setScreen] = useState("tables");
  const [selectedTable, setSelectedTable] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [orderNote, setOrderNote] = useState("");
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("Tümü");

  const [openOrders, setOpenOrders] = useState([]);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [isCurrentOrderPending, setIsCurrentOrderPending] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitType, setSplitType] = useState("equal");
  const [splitPeople, setSplitPeople] = useState(2);
  const [splitSelections, setSplitSelections] = useState({});
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [autoSaveVersion, setAutoSaveVersion] = useState(0);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const emptyProductForm = {
    name: "",
    category: "",
    price: "",
    stock: "",
    active: true
  };
  const [editingProductName, setEditingProductName] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productStatus, setProductStatus] = useState("");
  const [productSaving, setProductSaving] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [stockEntryAmounts, setStockEntryAmounts] = useState({});
  const [stockEntryNotes, setStockEntryNotes] = useState({});
  const [stockEntryStatus, setStockEntryStatus] = useState("");

  function handleLogin(event) {
  event.preventDefault();

  if (passwordInput === panelPassword) {
    sessionStorage.setItem("saray-panel-auth", "true");
    setIsAuthenticated(true);
    setPasswordInput("");
    setPasswordError("");
    return;
  }

  setPasswordError("Şifre hatalı.");
}

  function logout() {
  sessionStorage.removeItem("saray-panel-auth");
  setIsAuthenticated(false);
  setPasswordInput("");
  setPasswordError("");
  setScreen("tables");
  setSelectedTable(null);
  setCurrentOrderId(null);
  setIsCurrentOrderPending(false);
  setOrderNote("");
  setTransferMode(false);
  setMobileCartOpen(false);
}

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
      status: "cancelled",
      note: orderNote.trim()
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
    const list = Array.from(new Set(
      products
        .filter(product => product.active !== false)
        .map(product => product.category)
        .filter(Boolean)
    ));
    return ["Tümü", ...list];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const activeProducts = products.filter(product => product.active !== false);
    const categoryProducts = category === "Tümü"
      ? activeProducts
      : activeProducts.filter(product => product.category === category);

    if (!normalizedSearch) return categoryProducts;

    return categoryProducts.filter(product =>
      product.name?.toLowerCase().includes(normalizedSearch) ||
      product.category?.toLowerCase().includes(normalizedSearch)
    );
  }, [products, category, searchTerm]);

  const quickProducts = useMemo(() => {
    return QUICK_PRODUCT_NAMES
      .map(quickName => products.find(product =>
        product.active !== false &&
        product.name?.toLocaleLowerCase("tr-TR") === quickName.toLocaleLowerCase("tr-TR")
      ))
      .filter(Boolean);
  }, [products]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const splitSelectedTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const selectedQuantity = Number(splitSelections[item.name] || 0);
      return sum + item.price * selectedQuantity;
    }, 0);
  }, [cartItems, splitSelections]);

  useEffect(() => {
  if (autoSaveVersion === 0 || screen !== "order" || !selectedTable) return;

  const timer = setTimeout(() => {
    saveOrder(false, { silent: true });
  }, 650);

  return () => clearTimeout(timer);
}, [autoSaveVersion, screen, selectedTable, cartItems.length, total]);

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

  const criticalStockProducts = useMemo(() => {
    return products
      .filter(product => product.active !== false && Number(product.stock || 0) <= 5)
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
  }, [products]);

  const stockEntryProducts = useMemo(() => {
    const normalizedSearch = stockSearchTerm.trim().toLowerCase();

    return products
      .filter(product => product.active !== false)
      .filter(product =>
        !normalizedSearch ||
        product.name?.toLowerCase().includes(normalizedSearch) ||
        product.category?.toLowerCase().includes(normalizedSearch)
      );
  }, [products, stockSearchTerm]);

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

  function resetProductForm() {
  setEditingProductName(null);
  setProductForm(emptyProductForm);
  setProductStatus("");
}

  function editProduct(product) {
  setEditingProductName(product.name);
  setProductForm({
    name: product.name || "",
    category: product.category || "",
    price: String(product.price ?? ""),
    stock: String(product.stock ?? ""),
    active: product.active !== false
  });
  setProductStatus("");
}

  async function saveProduct(event) {
  event.preventDefault();

  const name = productForm.name.trim();
  const categoryName = productForm.category.trim();
  const price = Number(productForm.price || 0);
  const stock = Number(productForm.stock || 0);

  if (!name) {
    setProductStatus("Ürün adı zorunlu.");
    return;
  }

  setProductSaving(true);
  setProductStatus("Kaydediliyor...");

  const payload = {
    name,
    category: categoryName,
    price,
    stock,
    active: productForm.active
  };

  const query = editingProductName
    ? supabase.from("products").update(payload).eq("name", editingProductName)
    : supabase.from("products").insert(payload);

  const { error } = await query;

  if (error) {
    console.error(error);
    setProductStatus("Ürün kaydedilemedi.");
    setProductSaving(false);
    return;
  }

  await loadProducts();
  setProductStatus("Ürün kaydedildi.");
  setProductSaving(false);
  setEditingProductName(null);
  setProductForm(emptyProductForm);
}

  async function toggleProductActive(product) {
  const nextActive = product.active === false;
  setProductStatus("Güncelleniyor...");

  const { error } = await supabase
    .from("products")
    .update({ active: nextActive })
    .eq("name", product.name);

  if (error) {
    console.error(error);
    setProductStatus("Ürün durumu güncellenemedi.");
    return;
  }

  await loadProducts();
  setProductStatus(nextActive ? "Ürün aktif edildi." : "Ürün pasif edildi.");
}

  async function addStock(product) {
  const quantity = Number(stockEntryAmounts[product.name] || 0);
  const note = stockEntryNotes[product.name]?.trim() || "Stok girişi";

  if (quantity <= 0) {
    setStockEntryStatus("Miktar 0'dan büyük olmalı.");
    return;
  }

  setStockEntryStatus("Stok güncelleniyor...");

  const { data: currentProduct, error: readError } = await supabase
    .from("products")
    .select("name,stock")
    .eq("name", product.name)
    .single();

  if (readError) {
    console.error(readError);
    setStockEntryStatus("Mevcut stok alınamadı.");
    return;
  }

  const currentStock = Number(currentProduct?.stock || 0);
  const nextStock = currentStock + quantity;

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock: nextStock })
    .eq("name", product.name);

  if (updateError) {
    console.error(updateError);
    setStockEntryStatus("Stok güncellenemedi.");
    return;
  }

  const { error: movementError } = await supabase
    .from("stock_movements")
    .insert({
      product_name: product.name,
      movement_type: "purchase",
      quantity,
      note
    });

  if (movementError) {
    console.error(movementError);
    setStockEntryStatus("Stok hareketi kaydedilemedi.");
    return;
  }

  await loadProducts();
  setStockEntryAmounts(prev => ({ ...prev, [product.name]: "" }));
  setStockEntryNotes(prev => ({ ...prev, [product.name]: "" }));
  setStockEntryStatus(`${product.name} stoğu güncellendi.`);
}

  async function openOrder(tableName) {
  setSelectedTable(tableName);
  setStatus("");
  setSearchTerm("");
  setTransferMode(false);
  setSplitMode(false);
  setSplitSelections({});
  setOrderNote("");
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
  setOrderNote(existingOrder.note || "");
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
    setAutoSaveVersion(version => version + 1);
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
    setAutoSaveVersion(version => version + 1);
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
  setOrderNote("");
  setTransferMode(false);
  setSplitMode(false);
  setSplitSelections({});
  setMobileCartOpen(false);
  setStatus("");
  await loadOpenOrders();
  setScreen("tables");
}

  function setSplitItemQuantity(item, quantity) {
  const safeQuantity = Math.max(0, Math.min(Number(quantity || 0), item.quantity));

  setSplitSelections(prev => ({
    ...prev,
    [item.name]: safeQuantity
  }));
}

  async function paySelectedSplitItems() {
  if (!currentOrderId || !isCurrentOrderPending) {
    setStatus("Sadece açık hesaplar bölünebilir.");
    return;
  }

  const selectedItems = Object.entries(splitSelections)
    .filter(([, quantity]) => Number(quantity || 0) > 0);

  if (selectedItems.length === 0) {
    setStatus("Ödenecek ürün seç.");
    return;
  }

  setStatus("Seçilenler ödeniyor...");

  const { data: latestItems, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", currentOrderId);

  if (itemsError) {
    console.error(itemsError);
    setStatus("Adisyon ürünleri alınamadı.");
    return;
  }

  const latestItemsByName = (latestItems || []).reduce((itemsByName, item) => {
    itemsByName[item.product_name] = item;
    return itemsByName;
  }, {});

  const splitPaymentPayload = selectedItems.map(([productName, quantity]) => ({
    productName,
    selectedQuantity: Number(quantity || 0),
    currentQuantity: Number(latestItemsByName[productName]?.quantity || 0)
  }));

  console.log("Selected split payment payload", splitPaymentPayload);

  for (const item of cartItems) {
    const latestItem = latestItemsByName[item.name];
    if (!latestItem) continue;

    const paidQuantity = Math.min(
      Number(splitSelections[item.name] || 0),
      Number(latestItem.quantity || 0)
    );
    const remainingQuantity = Number(latestItem.quantity || 0) - paidQuantity;
    const unitPrice = Number(latestItem.unit_price || item.price || 0);
    const remainingLineTotal = unitPrice * remainingQuantity;

    if (paidQuantity <= 0) continue;

    const { data: currentProduct, error: stockReadError } = await supabase
      .from("products")
      .select("name,stock")
      .eq("name", item.name)
      .single();

    if (stockReadError) {
      console.error("Split stock read failed", {
        productName: item.name,
        error: stockReadError
      });
      setStatus("Stok bilgisi alınamadı.");
      return;
    }

    const currentDatabaseStock = Number(currentProduct?.stock || 0);
    const newStock = Math.max(0, currentDatabaseStock - paidQuantity);

    console.log("Split stock update", {
      productName: item.name,
      currentDatabaseStock,
      paidQuantity,
      newStock
    });

    const { error: stockUpdateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("name", item.name);

    if (stockUpdateError) {
      console.error("Split stock update failed", {
        productName: item.name,
        attemptedStock: newStock,
        error: stockUpdateError
      });
      setStatus("Stok güncellenemedi.");
      return;
    }

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        product_name: item.name,
        movement_type: "sale",
        quantity: -paidQuantity,
        note: `${selectedTable} split payment`
      });

    if (movementError) {
      console.error("Split stock movement insert failed", {
        productName: item.name,
        quantity: -paidQuantity,
        error: movementError
      });
    }

    if (remainingQuantity <= 0) {
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", currentOrderId)
        .eq("product_name", item.name);

      if (deleteError) {
        console.error(deleteError);
        setStatus("Ödenen ürün silinemedi.");
        return;
      }
    } else {
      const { error: updateItemError } = await supabase
        .from("order_items")
        .update({
          quantity: remainingQuantity,
          total_price: remainingLineTotal
        })
        .eq("order_id", currentOrderId)
        .eq("product_name", item.name);

      if (updateItemError) {
        console.error(updateItemError);
        setStatus("Adisyon ürünü güncellenemedi.");
        return;
      }
    }
  }

  const { data: remainingItems, error: remainingItemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", currentOrderId);

  if (remainingItemsError) {
    console.error(remainingItemsError);
    setStatus("Kalan adisyon ürünleri alınamadı.");
    return;
  }

  console.log("Updated remaining split items", remainingItems || []);

  const nextCart = {};
  const remainingTotal = (remainingItems || []).reduce((sum, item) => {
    const unitPrice = Number(item.unit_price || 0);
    const quantity = Number(item.quantity || 0);

    if (quantity > 0) {
      nextCart[item.product_name] = {
        name: item.product_name,
        price: unitPrice,
        quantity,
        product: {
          name: item.product_name,
          price: unitPrice
        }
      };
    }

    return sum + Number(item.total_price || unitPrice * quantity);
  }, 0);

  const allPaid = remainingTotal <= 0;
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total_price: remainingTotal,
      paid: allPaid,
      status: allPaid ? "completed" : "pending"
    })
    .eq("id", currentOrderId)
    .eq("status", "pending");

  if (orderError) {
    console.error(orderError);
    setStatus("Adisyon güncellenemedi.");
    return;
  }

  setSplitSelections({});
  setSplitMode(false);

  if (allPaid) {
    setCart({});
    setCurrentOrderId(null);
    setIsCurrentOrderPending(false);
    setSelectedTable(null);
    setOrderNote("");
    setMobileCartOpen(false);
    setStatus("");
    await loadOpenOrders();
    setScreen("tables");
    return;
  }

  setCart(nextCart);
  setStatus("Seçilen ürünler ödendi.");
  await loadOpenOrders();
}

  async function saveOrder(markPaid = false, options = {}) {
  const silent = options.silent === true;

  if (!selectedTable) {
    if (!silent) setStatus("Önce masa ve ürün seç.");
    return;
  }

  if (!silent) setStatus("Kaydediliyor...");

  let orderId = currentOrderId;
  let orderWasPending = Boolean(orderId);

  if (cartItems.length === 0) {
    if (!orderId) {
      const existingOrder = await findPendingOrderByTable(selectedTable);
      orderId = existingOrder?.id;
    }

    if (!orderId) {
      if (!silent) setStatus("Once masa ve urun sec.");
      return;
    }

    const cleared = await clearOrder(orderId);

    if (!cleared) return;

    setCart({});
    setCurrentOrderId(null);
    setIsCurrentOrderPending(false);
    setSelectedTable(null);
    setOrderNote("");
    setTransferMode(false);
    setSplitMode(false);
    setSplitSelections({});
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
        status: markPaid ? "completed" : "pending",
        note: orderNote.trim()
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
        status: markPaid ? "completed" : "pending",
        note: orderNote.trim()
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
      const { data: currentProduct, error: stockReadError } = await supabase
        .from("products")
        .select("name,stock")
        .eq("name", item.name)
        .single();

      if (stockReadError) {
        console.error("Stock read failed", {
          productName: item.name,
          error: stockReadError
        });
        setStatus("Stok bilgisi alınamadı.");
        return;
      }

      const currentDatabaseStock = Number(currentProduct?.stock || 0);
      const soldQuantity = Number(item.quantity || 0);
      const newStock = Math.max(0, currentDatabaseStock - soldQuantity);

      console.log("Stock update", {
        productName: item.name,
        currentDatabaseStock,
        soldQuantity,
        newStock
      });

      const { error: stockUpdateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("name", item.name);

      if (stockUpdateError) {
        console.error("Stock update failed", {
          productName: item.name,
          attemptedStock: newStock,
          error: stockUpdateError
        });
        setStatus("Stok güncellenemedi.");
        return;
      }

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_name: item.name,
          movement_type: "sale",
          quantity: -item.quantity,
          note: `${selectedTable} satışı`
        });

      if (movementError) {
        console.error("Stock movement insert failed", {
          productName: item.name,
          quantity: -item.quantity,
          error: movementError
        });
      }
    }

    setCart({});
    setCurrentOrderId(null);
    setIsCurrentOrderPending(false);
    setOrderNote("");
    setTransferMode(false);
    setSplitMode(false);
    setSplitSelections({});
    setMobileCartOpen(false);

    await loadProducts();
  }

  if (!silent) {
    setStatus(
      markPaid
        ? "Ödeme alındı. Sipariş tamamlandı."
        : "Sipariş kaydedildi."
    );
  }

  await loadOpenOrders();
}

  if (!isAuthenticated) {
    return (
      <div className="app login-layout">
        <form className="login-panel" onSubmit={handleLogin}>
          <ClipboardList size={42} />
          <div>
            <h1>Saray Kafe Yönetim Paneli</h1>
            <p>Devam etmek için panel şifresini girin.</p>
          </div>

          <input
            type="password"
            value={passwordInput}
            onChange={event => setPasswordInput(event.target.value)}
            placeholder="Şifre"
            autoFocus
          />

          {passwordError && <p className="status">{passwordError}</p>}

          <button type="submit">Giriş Yap</button>
        </form>
      </div>
    );
  }

  if (screen === "tables") {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <h1>Saray Kafe Yönetim Paneli</h1>
            <p>Masa, paket ve gel-al sipariş takibi</p>
          </div>
          <div className="topbar-actions grouped-actions">
            <div className="action-group">
              <span>Raporlar</span>
              <button className="report-button" onClick={loadEndOfDayReport} disabled={reportLoading}>
                <BarChart3 size={18} /> {reportLoading ? "Hazırlanıyor" : "Gün Sonu"}
              </button>
            </div>
            <div className="action-group">
              <span>Yönetim</span>
              <button className="manage-button" onClick={() => setScreen("products")}>
                <Boxes size={18} /> Ürünler
              </button>
            </div>
            <div className="action-group">
              <span>Stok</span>
              <button className="stock-button" onClick={() => setScreen("stock-entry")}>
                Stok Girişi
              </button>
            </div>
            <button className="logout-button" onClick={logout}>Çıkış Yap</button>
            <ClipboardList className="brand-mark" size={34} />
          </div>
        </header>

        <main className="dashboard-shell">
          <section className="dashboard-main">
            <div className="section-title">
              <div>
                <h2>Masalar</h2>
                <p>Canlı adisyon durumları</p>
              </div>
            </div>

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
                    <div className="table-card-top">
                      <span className="table-icon">{t.includes("Paket") ? <Package /> : t.includes("Gel") ? <ShoppingBag /> : <Coffee />}</span>
                      <span className="table-state">{isOpen ? "Açık" : "Boş"}</span>
                    </div>
                    <div className="table-card-body">
                      <strong>{t}</strong>
                      <span>{isOpen ? "Açık Hesap" : "Boş Masa"}</span>
                    </div>
                    {isOpen && <b className="table-total">{formatPrice(pendingOrder.total_price)}</b>}
                  </button>
                );
              })}
            </section>
          </section>

          <aside className="dashboard-side">
            <section className="stats">
              <div><b>{products.length}</b><span>Ürün</span></div>
              <button className="stat-card" onClick={() => setScreen("critical-stock")}>
                <b>{criticalStockProducts.length}</b><span>Kritik Stok</span>
              </button>
              <div><b>Hazır</b><span>Sistem</span></div>
            </section>
          </aside>
        </main>

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

  if (screen === "products") {
    return (
      <div className="app product-management">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>Ürün Yönetimi</h1>
            <p>Menü, fiyat, stok ve aktiflik ayarları</p>
          </div>
        </header>

        <section className="product-admin-layout">
          <form className="product-form" onSubmit={saveProduct}>
            <h2>{editingProductName ? "Ürünü Düzenle" : "Yeni Ürün"}</h2>

            <label>
              Ürün adı
              <input
                value={productForm.name}
                onChange={event => setProductForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Örn. Türk Kahvesi"
              />
            </label>

            <label>
              Kategori
              <input
                value={productForm.category}
                onChange={event => setProductForm(prev => ({ ...prev, category: event.target.value }))}
                placeholder="Örn. İçecek"
              />
            </label>

            <div className="form-grid">
              <label>
                Fiyat
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={event => setProductForm(prev => ({ ...prev, price: event.target.value }))}
                />
              </label>

              <label>
                Stok
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.stock}
                  onChange={event => setProductForm(prev => ({ ...prev, stock: event.target.value }))}
                />
              </label>
            </div>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={productForm.active}
                onChange={event => setProductForm(prev => ({ ...prev, active: event.target.checked }))}
              />
              Aktif ürün
            </label>

            {productStatus && <p className="status">{productStatus}</p>}

            <div className="form-actions">
              <button type="submit" disabled={productSaving}>
                <Save size={18} /> {productSaving ? "Kaydediliyor" : "Kaydet"}
              </button>
              <button type="button" onClick={resetProductForm}>Temizle</button>
            </div>
          </form>

          <section className="product-admin-list">
            {products.map(product => (
              <div className={`product-row ${product.active === false ? "inactive" : ""}`} key={product.name}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.category || "Kategorisiz"}</span>
                </div>
                <b>{formatPrice(product.price)}</b>
                <em>{Number(product.stock || 0)} stok</em>
                <small>{product.active === false ? "Pasif" : "Aktif"}</small>
                <div className="product-row-actions">
                  <button onClick={() => editProduct(product)}>Düzenle</button>
                  <button onClick={() => toggleProductActive(product)}>
                    {product.active === false ? "Aktif Yap" : "Pasif Yap"}
                  </button>
                </div>
              </div>
            ))}
          </section>
        </section>
      </div>
    );
  }

  if (screen === "critical-stock") {
    return (
      <div className="app critical-stock-page">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>Kritik Stok</h1>
            <p>Stok seviyesi 5 veya altında olan aktif ürünler</p>
          </div>
          <button className="manage-button" onClick={() => setScreen("products")}>
            <Boxes size={18} /> Ürün Yönetimi
          </button>
        </header>

        <section className="critical-list">
          {criticalStockProducts.length === 0 && (
            <div className="critical-empty">
              <strong>Kritik stokta ürün yok.</strong>
              <span>Tüm aktif ürünlerin stok seviyesi yeterli görünüyor.</span>
            </div>
          )}

          {criticalStockProducts.map(product => {
            const stock = Number(product.stock || 0);

            return (
              <div className={`critical-row ${stock === 0 ? "sold-out" : ""}`} key={product.name}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.category || "Kategorisiz"}</span>
                </div>
                <b>{stock} stok</b>
                <em>{formatPrice(product.price)}</em>
                <small>{stock === 0 ? "Tükendi" : "Kritik"}</small>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  if (screen === "stock-entry") {
    return (
      <div className="app stock-entry-page">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>Stok Girişi</h1>
            <p>Aktif ürünlerin stoklarını güncelleyin</p>
          </div>
        </header>

        <div className="order-tools">
          <label className="search-box">
            <Search size={18} />
            <input
              value={stockSearchTerm}
              onChange={event => setStockSearchTerm(event.target.value)}
              placeholder="Ürün ara"
            />
          </label>
        </div>

        {stockEntryStatus && <p className="status">{stockEntryStatus}</p>}

        <section className="stock-entry-list">
          {stockEntryProducts.length === 0 && (
            <div className="critical-empty">
              <strong>Aktif ürün bulunamadı.</strong>
              <span>Arama kriterini değiştirin veya ürün yönetiminden ürünleri aktif edin.</span>
            </div>
          )}

          {stockEntryProducts.map(product => (
            <div className="stock-entry-row" key={product.name}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.category || "Kategorisiz"}</span>
              </div>
              <b>{Number(product.stock || 0)} stok</b>
              <input
                type="number"
                min="1"
                step="1"
                value={stockEntryAmounts[product.name] || ""}
                onChange={event => setStockEntryAmounts(prev => ({ ...prev, [product.name]: event.target.value }))}
                placeholder="Miktar"
              />
              <input
                value={stockEntryNotes[product.name] || ""}
                onChange={event => setStockEntryNotes(prev => ({ ...prev, [product.name]: event.target.value }))}
                placeholder="Not"
              />
              <button onClick={() => addStock(product)}>Stok Ekle</button>
            </div>
          ))}
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
          <p>Adisyon yönetimi</p>
        </div>
      </header>

      {quickProducts.length > 0 && (
        <section className="quick-products">
          <div className="quick-head">
            <strong>Favoriler / Hızlı Ürünler</strong>
            <span>Tek dokunuşla +1</span>
          </div>
          <div className="quick-grid">
            {quickProducts.map(product => (
              <button key={product.name} onClick={() => addProduct(product)}>
                <span>{product.name}</span>
                <b>{formatPrice(product.price)}</b>
              </button>
            ))}
          </div>
        </section>
      )}

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
              <div className="product-card quick-add-card" key={product.name} onClick={() => addProduct(product)}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.category}</span>
                  <b>{Number(product.price || 0)} ₺</b>
                </div>
                <div className="counter">
                  <button onClick={event => {
                    event.stopPropagation();
                    removeProduct(product);
                  }}>-</button>
                  <em>{qty}</em>
                  <button onClick={event => {
                    event.stopPropagation();
                    addProduct(product);
                  }}>+</button>
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

          <label className="order-note">
            Sipariş Notu
            <textarea
              value={orderNote}
              onChange={event => setOrderNote(event.target.value)}
              placeholder="açık çay, şekersiz, ısıtılacak, paket olsun"
              rows={3}
            />
          </label>

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

          {isCurrentOrderPending && currentOrderId && (
            <div className="split-panel">
              <button className="split-toggle" onClick={() => setSplitMode(prev => !prev)}>
                Adisyon Böl
              </button>

              {splitMode && (
                <div className="split-content">
                  <div className="split-tabs">
                    <button className={splitType === "equal" ? "active" : ""} onClick={() => setSplitType("equal")}>
                      Eşit Böl
                    </button>
                    <button className={splitType === "items" ? "active" : ""} onClick={() => setSplitType("items")}>
                      Ürün Seçerek Öde
                    </button>
                  </div>

                  {splitType === "equal" && (
                    <div className="equal-split">
                      <label>
                        Kişi sayısı
                        <input
                          type="number"
                          min="1"
                          value={splitPeople}
                          onChange={event => setSplitPeople(Math.max(1, Number(event.target.value || 1)))}
                        />
                      </label>
                      <div>
                        <span>Kişi başı</span>
                        <strong>{formatPrice(total / Math.max(1, splitPeople))}</strong>
                      </div>
                    </div>
                  )}

                  {splitType === "items" && (
                    <div className="item-split">
                      {cartItems.map(item => (
                        <div className="split-line" key={item.name}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.quantity} adet · {formatPrice(item.price)}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={splitSelections[item.name] || 0}
                            onChange={event => setSplitItemQuantity(item, event.target.value)}
                          />
                        </div>
                      ))}

                      <div className="split-total">
                        <span>Ödenecek Ara Toplam</span>
                        <strong>{formatPrice(splitSelectedTotal)}</strong>
                      </div>

                      <button className="split-pay" onClick={paySelectedSplitItems}>
                        Seçilenleri Öde
                      </button>
                    </div>
                  )}
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
          <small>{cartItems.length} ürün</small>
        </div>
        <button onClick={() => setMobileCartOpen(true)}>Adisyonu Aç</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
