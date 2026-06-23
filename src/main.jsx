import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Coffee, ShoppingBag, Package, ArrowLeft, CreditCard, Save, Search, ClipboardList, ArrowRightLeft, BarChart3, Boxes, Star, CalendarClock, AlertTriangle, WalletCards, Menu, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import "./style.css";

const TABLES = [
  "Masa 1", "Masa 2", "Masa 3", "Masa 4",
  "Masa 5", "Masa 6", "Masa 7", "Masa 8",
  "Masa 9", "Masa 10", "Masa 11", "Masa 12",
  "Masa 13", "Paket", "Gel Al"
];

const normalizeTableName = value => value?.trim().toLowerCase();

const formatPrice = value => `${Number(value || 0)} ₺`;

const isWeightedCartItem = item =>
  item.product?.unit_type === "weighted" || / - \d+([.,]\d+)? TL$/.test(item.name);

const getWeightedBaseName = item => item.name.replace(/ - \d+([.,]\d+)? TL$/, "");

const emptyExpiryForm = {
  product_name: "",
  quantity: "1",
  location: "Dolap",
  expiry_date: "",
  note: "",
  active: true
};

const createDailyRevenueForm = dateValue => ({
  revenue_date: dateValue,
  cash_amount: "",
  card_amount: "",
  other_amount: "",
  note: ""
});

const parseDateOnly = value => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getExpiryDaysLeft = value => {
  const expiry = parseDateOnly(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / 86400000);
};

const getExpiryLabel = days => {
  if (days < 0) return `${Math.abs(days)} gün geçti`;
  if (days === 0) return "Bugün son gün";
  return `${days} gün kaldı`;
};

const getExpiryTone = days => {
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if ([1, 2, 3, 7].includes(days)) return `days-${days}`;
  if (days <= 7) return "approaching";
  return "safe";
};

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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [orderNoteOpen, setOrderNoteOpen] = useState(false);
  const [autoSaveVersion, setAutoSaveVersion] = useState(0);
  const [weightedProduct, setWeightedProduct] = useState(null);
  const [weightedAmount, setWeightedAmount] = useState("");
  const favoritePressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [reportDate, setReportDate] = useState(() => getDateInputValue(new Date()));
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const emptyProductForm = {
    name: "",
    category: "",
    price: "",
    stock: "",
    active: true,
    favorite: false,
    unit_type: "piece"
  };
  const [editingProductName, setEditingProductName] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productStatus, setProductStatus] = useState("");
  const [productSaving, setProductSaving] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [stockEntryAmounts, setStockEntryAmounts] = useState({});
  const [stockEntryNotes, setStockEntryNotes] = useState({});
  const [stockEntryStatus, setStockEntryStatus] = useState("");
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("today");
  const [historyDate, setHistoryDate] = useState(() => getDateInputValue(new Date()));
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [expiryItems, setExpiryItems] = useState([]);
  const [expiryForm, setExpiryForm] = useState(emptyExpiryForm);
  const [editingExpiryId, setEditingExpiryId] = useState(null);
  const [expiryStatus, setExpiryStatus] = useState("");
  const [expirySaving, setExpirySaving] = useState(false);
  const [dailyRevenueForm, setDailyRevenueForm] = useState(() => createDailyRevenueForm(getDateInputValue(new Date())));
  const [dailyRevenues, setDailyRevenues] = useState([]);
  const [dailyRevenueStatus, setDailyRevenueStatus] = useState("");
  const [dailyRevenueSaving, setDailyRevenueSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
  loadExpiryItems();
  loadDailyRevenues();
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

  const orders = data || [];
  const orderIds = orders.map(order => order.id).filter(Boolean);

  if (orderIds.length === 0) {
    setOpenOrders([]);
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id,product_name,quantity,unit_price,total_price")
    .in("order_id", orderIds);

  if (itemsError) {
    console.error(itemsError);
    setOpenOrders(orders);
    return;
  }

  const itemsByOrderId = (items || []).reduce((groupedItems, item) => {
    groupedItems[item.order_id] = groupedItems[item.order_id] || [];
    groupedItems[item.order_id].push(item);
    return groupedItems;
  }, {});

  setOpenOrders(orders.map(order => ({
    ...order,
    items: itemsByOrderId[order.id] || []
  })));
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
    return ["Favoriler", "Tümü", ...list];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const activeProducts = products.filter(product => product.active !== false);
    const categoryProducts = category === "Favoriler"
      ? activeProducts.filter(product => product.favorite === true)
      : category === "Tümü"
        ? activeProducts
        : activeProducts.filter(product => product.category === category);

    if (!normalizedSearch) return categoryProducts;

    return categoryProducts.filter(product =>
      product.name?.toLowerCase().includes(normalizedSearch) ||
      product.category?.toLowerCase().includes(normalizedSearch)
    );
  }, [products, category, searchTerm]);

  const favoriteProducts = useMemo(() => {
    return products.filter(product => product.active !== false && product.favorite === true);
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
  }, [autoSaveVersion, screen, selectedTable, cartItems.length, total, orderNote]);

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

  const expirySummary = useMemo(() => {
    const activeItems = expiryItems.filter(item => item.active !== false);
    return {
      approaching: activeItems.filter(item => {
        const days = getExpiryDaysLeft(item.expiry_date);
        return days >= 0 && days <= 7;
      }).length,
      expired: activeItems.filter(item => getExpiryDaysLeft(item.expiry_date) < 0).length
    };
  }, [expiryItems]);

  const todayExpiryCount = useMemo(() => {
    return expiryItems.filter(item =>
      item.active !== false && getExpiryDaysLeft(item.expiry_date) === 0
    ).length;
  }, [expiryItems]);

  const todayRevenueTotal = useMemo(() => {
    const todayValue = getDateInputValue(new Date());
    const todayRecord = dailyRevenues.find(record => record.revenue_date === todayValue);
    return Number(todayRecord?.total_amount || 0);
  }, [dailyRevenues]);

  const todayHeaderLabel = useMemo(() => {
    return new Date().toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }, []);

  const sortedExpiryItems = useMemo(() => {
    return [...expiryItems].sort((a, b) =>
      a.expiry_date.localeCompare(b.expiry_date) || a.product_name.localeCompare(b.product_name, "tr")
    );
  }, [expiryItems]);

  const dailyRevenueTotal = useMemo(() => {
    return ["cash_amount", "card_amount", "other_amount"].reduce(
      (sum, key) => sum + Number(dailyRevenueForm[key] || 0),
      0
    );
  }, [dailyRevenueForm]);

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

  const filteredHistoryOrders = useMemo(() => {
    const normalizedSearch = historySearchTerm.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedSearch) return historyOrders;

    return historyOrders.filter(order => {
      const tableName = order.table_name?.toLocaleLowerCase("tr-TR") || "";
      const note = order.note?.toLocaleLowerCase("tr-TR") || "";
      const itemMatch = (order.items || []).some(item =>
        item.product_name?.toLocaleLowerCase("tr-TR").includes(normalizedSearch)
      );

      return tableName.includes(normalizedSearch) || note.includes(normalizedSearch) || itemMatch;
    });
  }, [historyOrders, historySearchTerm]);

  function getDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getLocalDayRange(dateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))) {
      throw new Error(`Invalid report date: ${String(dateValue)}`);
    }

    const [year, month, day] = dateValue.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);

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

  function getHistoryDateRange(filter = historyFilter, dateValue = historyDate) {
    const todayValue = getDateInputValue(new Date());

    if (filter === "today") return getLocalDayRange(todayValue);

    if (filter === "yesterday") {
      const today = new Date();
      const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      return getLocalDayRange(getDateInputValue(yesterday));
    }

    if (filter === "last7") {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        label: "Son 7 gün"
      };
    }

    return getLocalDayRange(dateValue);
  }

  async function loadEndOfDayReport(dateValue = reportDate) {
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
    ? dateValue
    : reportDate;

  setReportLoading(true);
  setStatus("");
  setReportDate(requestedDate);

  try {
    const selectedDay = getLocalDayRange(requestedDate);
    console.log("Loading report", {
      dateValue: requestedDate,
      start: selectedDay.start,
      end: selectedDay.end
    });

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id,total_price,created_at")
      .eq("status", "completed")
      .eq("paid", true)
      .gte("created_at", selectedDay.start)
      .lt("created_at", selectedDay.end);

    if (ordersError) {
      console.error("Report orders query failed", {
        dateValue: requestedDate,
        range: selectedDay,
        error: ordersError
      });
      setStatus("Rapor alınamadı. Sipariş kayıtları okunamadı.");
      setReport(null);
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
        console.error("Report order_items query failed", {
          dateValue: requestedDate,
          orderIds,
          error: itemsError
        });
        setStatus("Rapor ürünleri alınamadı. Lütfen tekrar deneyin.");
        setReport(null);
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
      dateValue: requestedDate,
      dateLabel: selectedDay.label,
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
  } catch (error) {
    console.error("Report loading failed", {
      dateValue: requestedDate,
      error
    });
    setStatus("Rapor hazırlanamadı. Tarih aralığı kontrol edilemedi.");
    setReport(null);
  } finally {
    setReportLoading(false);
  }
}

  function changeReportDate(offsetDays) {
  const activeDate = report?.dateValue || reportDate;
  const [year, month, day] = activeDate.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day + offsetDays);
  loadEndOfDayReport(getDateInputValue(nextDate));
}

  async function loadOrderHistory(filter = historyFilter, dateValue = historyDate) {
  setHistoryLoading(true);
  setHistoryStatus("");
  setHistoryFilter(filter);
  setHistoryDate(dateValue);

  try {
    const selectedRange = getHistoryDateRange(filter, dateValue);
    console.log("Loading order history", {
      filter,
      dateValue,
      start: selectedRange.start,
      end: selectedRange.end
    });

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id,table_name,status,total_price,note,created_at,paid")
      .in("status", ["completed", "cancelled"])
      .gte("created_at", selectedRange.start)
      .lt("created_at", selectedRange.end)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Order history query failed", {
        filter,
        dateValue,
        range: selectedRange,
        error: ordersError
      });
      setHistoryStatus("Sipariş geçmişi alınamadı.");
      setHistoryOrders([]);
      return;
    }

    const historicalOrders = orders || [];
    const orderIds = historicalOrders.map(order => order.id).filter(Boolean);
    let items = [];

    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id,product_name,quantity,unit_price,total_price")
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("Order history items query failed", {
          filter,
          dateValue,
          orderIds,
          error: itemsError
        });
        setHistoryStatus("Sipariş ürünleri alınamadı.");
        setHistoryOrders([]);
        return;
      }

      items = orderItems || [];
    }

    const itemsByOrderId = items.reduce((groupedItems, item) => {
      groupedItems[item.order_id] = groupedItems[item.order_id] || [];
      groupedItems[item.order_id].push(item);
      return groupedItems;
    }, {});

    setHistoryOrders(historicalOrders.map(order => ({
      ...order,
      items: itemsByOrderId[order.id] || []
    })));
  } catch (error) {
    console.error("Order history loading failed", {
      filter,
      dateValue,
      error
    });
    setHistoryStatus("Sipariş geçmişi hazırlanamadı.");
    setHistoryOrders([]);
  } finally {
    setHistoryLoading(false);
  }
}

  function openOrderHistory() {
  setMobileNavOpen(false);
  setScreen("order-history");
  loadOrderHistory(historyFilter, historyDate);
}

  function openDailyRevenueScreen() {
  setMobileNavOpen(false);
  setScreen("daily-revenue");
  loadDailyRevenues();
}

  async function loadDailyRevenues() {
  const { data, error } = await supabase
    .from("daily_revenues")
    .select("*")
    .order("revenue_date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Daily revenues could not be loaded", error);
    setDailyRevenueStatus("Gün sonu kayıtları alınamadı. Supabase tablosunu kontrol edin.");
    setDailyRevenues([]);
    return;
  }

  setDailyRevenues(data || []);
}

  function resetDailyRevenueForm() {
  setDailyRevenueForm(createDailyRevenueForm(getDateInputValue(new Date())));
  setDailyRevenueStatus("");
}

  async function saveDailyRevenue(event) {
  event.preventDefault();

  const cashAmount = Number(dailyRevenueForm.cash_amount || 0);
  const cardAmount = Number(dailyRevenueForm.card_amount || 0);
  const otherAmount = Number(dailyRevenueForm.other_amount || 0);

  if (!dailyRevenueForm.revenue_date) {
    setDailyRevenueStatus("Tarih seçmek zorunlu.");
    return;
  }

  if ([cashAmount, cardAmount, otherAmount].some(amount => Number.isNaN(amount) || amount < 0)) {
    setDailyRevenueStatus("Tutarlar 0 veya daha büyük olmalı.");
    return;
  }

  setDailyRevenueSaving(true);
  setDailyRevenueStatus("Kapanış kaydediliyor...");

  const payload = {
    revenue_date: dailyRevenueForm.revenue_date,
    cash_amount: cashAmount,
    card_amount: cardAmount,
    other_amount: otherAmount,
    total_amount: cashAmount + cardAmount + otherAmount,
    note: dailyRevenueForm.note.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { data: existingRecord, error: readError } = await supabase
    .from("daily_revenues")
    .select("id")
    .eq("revenue_date", dailyRevenueForm.revenue_date)
    .maybeSingle();

  if (readError) {
    console.error("Daily revenue lookup failed", readError);
    setDailyRevenueStatus("Mevcut gün sonu kaydı kontrol edilemedi.");
    setDailyRevenueSaving(false);
    return;
  }

  const query = existingRecord?.id
    ? supabase.from("daily_revenues").update(payload).eq("id", existingRecord.id)
    : supabase.from("daily_revenues").insert(payload);

  const { error } = await query;

  if (error) {
    console.error("Daily revenue could not be saved", error);
    setDailyRevenueStatus("Gün sonu kapanışı kaydedilemedi.");
    setDailyRevenueSaving(false);
    return;
  }

  await loadDailyRevenues();
  setDailyRevenueStatus(existingRecord?.id ? "Bu tarih için kapanış güncellendi." : "Gün sonu kapanışı kaydedildi.");
  setDailyRevenueSaving(false);
}

  async function loadExpiryItems() {
  const { data, error } = await supabase
    .from("expiry_items")
    .select("*")
    .order("expiry_date", { ascending: true });

  if (error) {
    console.error("Expiry items could not be loaded", error);
    setExpiryStatus("SKT kayıtları alınamadı. Supabase tablosunu kontrol edin.");
    return;
  }

  setExpiryItems(data || []);
}

  function resetExpiryForm() {
  setEditingExpiryId(null);
  setExpiryForm(emptyExpiryForm);
  setExpiryStatus("");
}

  function editExpiryItem(item) {
  setEditingExpiryId(item.id);
  setExpiryForm({
    product_name: item.product_name || "",
    quantity: String(item.quantity ?? 1),
    location: item.location || "Dolap",
    expiry_date: item.expiry_date || "",
    note: item.note || "",
    active: item.active !== false
  });
  setExpiryStatus("");
}

  async function saveExpiryItem(event) {
  event.preventDefault();
  const productName = expiryForm.product_name.trim();
  const quantity = Number(expiryForm.quantity);

  if (!productName || !expiryForm.expiry_date) {
    setExpiryStatus("Ürün adı ve son kullanma tarihi zorunlu.");
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    setExpiryStatus("Adet 0 veya daha büyük bir tam sayı olmalı.");
    return;
  }

  setExpirySaving(true);
  setExpiryStatus("Kaydediliyor...");
  const payload = {
    product_name: productName,
    quantity,
    location: expiryForm.location,
    expiry_date: expiryForm.expiry_date,
    note: expiryForm.note.trim() || null,
    active: expiryForm.active
  };
  const query = editingExpiryId
    ? supabase.from("expiry_items").update(payload).eq("id", editingExpiryId)
    : supabase.from("expiry_items").insert(payload);
  const { error } = await query;

  if (error) {
    console.error("Expiry item could not be saved", error);
    setExpiryStatus("SKT kaydı kaydedilemedi.");
    setExpirySaving(false);
    return;
  }

  await loadExpiryItems();
  setEditingExpiryId(null);
  setExpiryForm(emptyExpiryForm);
  setExpiryStatus("SKT kaydı kaydedildi.");
  setExpirySaving(false);
}

  async function toggleExpiryActive(item) {
  setExpiryStatus("Güncelleniyor...");
  const { error } = await supabase
    .from("expiry_items")
    .update({ active: item.active === false })
    .eq("id", item.id);

  if (error) {
    console.error("Expiry item could not be updated", error);
    setExpiryStatus("Kayıt durumu güncellenemedi.");
    return;
  }

  await loadExpiryItems();
  setExpiryStatus("Kayıt durumu güncellendi.");
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
    active: product.active !== false,
    favorite: product.favorite === true,
    unit_type: product.unit_type || "piece"
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
    active: productForm.active,
    favorite: productForm.favorite,
    unit_type: productForm.unit_type || "piece"
  };

  const query = editingProductName
    ? supabase.from("products").update(payload).eq("name", editingProductName)
    : supabase.from("products").insert(payload);

  const { error } = await query;

  if (error) {
    console.error(error);
    setProductStatus(
      String(error.message || "").includes("favorite") || String(error.message || "").includes("unit_type")
        ? "Ürün kaydedilemedi. Supabase products tablosuna favorite ve unit_type kolonlarını ekleyin."
        : "Ürün kaydedilemedi."
    );
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

  async function toggleProductFavorite(product, options = {}) {
  if (!product?.name) return;
  const nextFavorite = product.favorite !== true;
  const source = options.source || "management";

  if (source === "management") setProductStatus("Favori güncelleniyor...");
  else setStatus(nextFavorite ? "Favorilere ekleniyor..." : "Favorilerden çıkarılıyor...");

  const { error } = await supabase
    .from("products")
    .update({ favorite: nextFavorite })
    .eq("name", product.name);

  if (error) {
    console.error(error);
    const message = "Favori güncellenemedi. Supabase products tablosuna favorite kolonunu ekleyin.";
    if (source === "management") setProductStatus(message);
    else setStatus(message);
    return;
  }

  await loadProducts();

  if (source === "management") {
    setProductStatus(nextFavorite ? "Ürün favorilere eklendi." : "Ürün favorilerden çıkarıldı.");
  } else {
    setStatus(nextFavorite ? "Favorilere eklendi." : "Favorilerden çıkarıldı.");
  }
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
    const baseName = getWeightedBaseName({ name: item.product_name });
    const baseProduct = products.find(product => product.name === baseName);
    const isWeighted = baseProduct?.unit_type === "weighted" || / - \d+([.,]\d+)? TL$/.test(item.product_name);
    const grams = isWeighted && Number(baseProduct?.price || 0) > 0
      ? Math.round((Number(item.unit_price || 0) / Number(baseProduct.price || 0)) * 1000)
      : null;

    restoredCart[item.product_name] = {
      name: item.product_name,
      price: Number(item.unit_price),
      quantity: item.quantity,
      grams,
      product: {
        name: isWeighted ? baseName : item.product_name,
        price: item.unit_price,
        unit_type: isWeighted ? "weighted" : baseProduct?.unit_type || "piece",
        grams
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

  function handleProductPress(product) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (product.unit_type === "weighted") {
      setWeightedProduct(product);
      setWeightedAmount("");
      return;
    }

    addProduct(product);
  }

  function startFavoriteLongPress(product) {
    longPressTriggered.current = false;
    window.clearTimeout(favoritePressTimer.current);
    favoritePressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      toggleProductFavorite(product, { source: "order" });
    }, 650);
  }

  function cancelFavoriteLongPress() {
    window.clearTimeout(favoritePressTimer.current);
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

  function deleteCartItem(itemName) {
    setCart(prev => {
      const next = { ...prev };
      delete next[itemName];
      return next;
    });
    setAutoSaveVersion(version => version + 1);
  }

  function confirmWeightedProduct() {
    const amount = Number(weightedAmount || 0);
    const kgPrice = Number(weightedProduct?.price || 0);

    if (!weightedProduct || amount <= 0 || kgPrice <= 0) {
      setStatus("Geçerli bir tutar gir.");
      return;
    }

    const grams = Math.round((amount / kgPrice) * 1000);
    const amountLabel = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    const cartName = `${weightedProduct.name} - ${amountLabel} TL`;

    setCart(prev => {
      const current = prev[cartName];
      return {
        ...prev,
        [cartName]: {
          product: {
            ...weightedProduct,
            unit_type: "weighted",
            base_name: weightedProduct.name,
            grams
          },
          name: cartName,
          price: amount,
          quantity: current ? current.quantity + 1 : 1,
          grams
        }
      };
    });

    setWeightedProduct(null);
    setWeightedAmount("");
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

    if (isWeightedCartItem(item)) {
      console.log("Skipping weighted split stock deduction", {
        productName: item.name,
        paidQuantity
      });
    } else {
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
      if (isWeightedCartItem(item)) {
        console.log("Skipping weighted stock deduction", {
          productName: item.name,
          quantity: item.quantity
        });
        continue;
      }

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

  function goToScreen(nextScreen) {
  setMobileNavOpen(false);
  setReport(null);
  setScreen(nextScreen);
}

  function openSalesReportFromNav() {
  setMobileNavOpen(false);
  setScreen("tables");
  loadEndOfDayReport();
}

  function renderSidebar() {
  const navItems = [
    { label: "Masalar", icon: Coffee, action: () => goToScreen("tables"), active: screen === "tables" },
    { label: "Gün Sonu", icon: WalletCards, action: openDailyRevenueScreen, active: screen === "daily-revenue" },
    { label: "Satış Raporları", icon: BarChart3, action: openSalesReportFromNav, active: Boolean(report) },
    { label: "Sipariş Geçmişi", icon: ClipboardList, action: openOrderHistory, active: screen === "order-history" },
    { label: "Ürünler", icon: Boxes, action: () => goToScreen("products"), active: screen === "products" },
    { label: "Stok Girişi", icon: Package, action: () => goToScreen("stock-entry"), active: screen === "stock-entry" },
    { label: "SKT Takip", icon: CalendarClock, action: () => goToScreen("expiry-tracking"), active: screen === "expiry-tracking" }
  ];

  return (
    <>
      <button className="mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Menüyü aç">
        <Menu size={22} />
      </button>
      {mobileNavOpen && <button className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Menüyü kapat" />}
      <aside className={`app-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span><Coffee size={24} /></span>
          <div>
            <strong>Saray Kafe</strong>
            <small>Yönetim Paneli</small>
          </div>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Menüyü kapat">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={item.active ? "active" : ""}
                onClick={item.action}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="sidebar-logout" onClick={logout}>
          Çıkış Yap
        </button>
      </aside>
    </>
  );
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
      <div className="app-shell">
        {renderSidebar()}

        <main className="app-content">
          <header className="dashboard-header">
            <div>
              <span className="eyebrow">Saray Kafe</span>
              <h1>Masalar</h1>
              <p>Masa, stok ve rapor takibi</p>
            </div>
            <div className="header-meta">
              <span>{todayHeaderLabel}</span>
              <b>İşletme Paneli</b>
            </div>
          </header>

          <section className="dashboard-summary">
            <button className="summary-card revenue" onClick={openDailyRevenueScreen}>
              <span>Bugünkü Ciro</span>
              <strong>{formatPrice(todayRevenueTotal)}</strong>
              <small>Gün sonu kaydı</small>
            </button>
            <button className="summary-card orders" onClick={() => goToScreen("tables")}>
              <span>Açık Adisyon</span>
              <strong>{openOrders.length}</strong>
              <small>Aktif masa / sipariş</small>
            </button>
            <button className="summary-card stock" onClick={() => goToScreen("critical-stock")}>
              <span>Kritik Stok</span>
              <strong>{criticalStockProducts.length}</strong>
              <small>Kontrol gereken ürün</small>
            </button>
            <button className="summary-card expiry" onClick={() => goToScreen("expiry-tracking")}>
              <span>Bugün SKT</span>
              <strong>{todayExpiryCount}</strong>
              <small>Bugün son gün</small>
            </button>
          </section>

          <section className="modern-panel">
            <div className="section-title">
              <div>
                <h2>Masa Durumu</h2>
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
                const previewItems = pendingOrder?.items || [];

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
                    {isOpen && previewItems.length > 0 && (
                      <div className="table-order-preview">
                        {previewItems.slice(0, 3).map(item => (
                          <span key={`${pendingOrder.id}-${item.product_name}`}>
                            {item.quantity}x {getWeightedBaseName({ name: item.product_name })}
                          </span>
                        ))}
                        {previewItems.length > 3 && (
                          <em>+{previewItems.length - 3} ürün</em>
                        )}
                      </div>
                    )}
                    {isOpen && <b className="table-total">{formatPrice(pendingOrder.total_price)}</b>}
                  </button>
                );
              })}
            </section>
          </section>

        {report && (
          <section className="report-panel">
            <div className="report-head">
              <div>
                <h2>Gün Sonu Raporu</h2>
                <p>{report.dateLabel}</p>
              </div>
              <div className="report-controls">
                <button onClick={() => changeReportDate(-1)} disabled={reportLoading}>Önceki Gün</button>
                <input
                  type="date"
                  value={report.dateValue || reportDate}
                  onChange={event => loadEndOfDayReport(event.target.value)}
                  disabled={reportLoading}
                />
                <button onClick={() => changeReportDate(1)} disabled={reportLoading}>Sonraki Gün</button>
                <button onClick={() => setReport(null)}>Kapat</button>
              </div>
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
                {report.topProducts.length === 0 && <p className="empty">Seçilen gün tamamlanan satış yok.</p>}
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
        </main>
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
                {productForm.unit_type === "weighted" ? "Kg fiyatı" : "Fiyat"}
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

            <label>
              Satış tipi
              <select
                value={productForm.unit_type}
                onChange={event => setProductForm(prev => ({ ...prev, unit_type: event.target.value }))}
              >
                <option value="piece">Adetli ürün</option>
                <option value="weighted">Tartılı / tutar bazlı</option>
              </select>
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={productForm.active}
                onChange={event => setProductForm(prev => ({ ...prev, active: event.target.checked }))}
              />
              Aktif ürün
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={productForm.favorite}
                onChange={event => setProductForm(prev => ({ ...prev, favorite: event.target.checked }))}
              />
              Favori / hızlı ürün
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
                <small>
                  {product.active === false ? "Pasif" : "Aktif"}
                  {product.favorite === true ? " · Favori" : ""}
                  {product.unit_type === "weighted" ? " · Tartılı" : ""}
                </small>
                <div className="product-row-actions">
                  <button
                    className={`favorite-toggle ${product.favorite === true ? "active" : ""}`}
                    onClick={() => toggleProductFavorite(product)}
                  >
                    <Star size={16} fill={product.favorite === true ? "currentColor" : "none"} />
                    {product.favorite === true ? "Favori" : "Favori Yap"}
                  </button>
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

  if (screen === "daily-revenue") {
    return (
      <div className="app daily-revenue-page">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>Gün Sonu Ciro</h1>
            <p>Nakit, kart ve diğer gelirleri kapat</p>
          </div>
        </header>

        <section className="daily-revenue-layout">
          <form className="product-form daily-revenue-form" onSubmit={saveDailyRevenue}>
            <h2>Kapanış Bilgileri</h2>

            <label>
              Tarih
              <input
                type="date"
                value={dailyRevenueForm.revenue_date}
                onChange={event => setDailyRevenueForm(prev => ({ ...prev, revenue_date: event.target.value }))}
              />
            </label>

            <div className="form-grid">
              <label>
                Nakit
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyRevenueForm.cash_amount}
                  onChange={event => setDailyRevenueForm(prev => ({ ...prev, cash_amount: event.target.value }))}
                  placeholder="0"
                />
              </label>

              <label>
                Kart
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyRevenueForm.card_amount}
                  onChange={event => setDailyRevenueForm(prev => ({ ...prev, card_amount: event.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>

            <label>
              Diğer
              <input
                type="number"
                min="0"
                step="0.01"
                value={dailyRevenueForm.other_amount}
                onChange={event => setDailyRevenueForm(prev => ({ ...prev, other_amount: event.target.value }))}
                placeholder="0"
              />
            </label>

            <label>
              Not
              <textarea
                value={dailyRevenueForm.note}
                onChange={event => setDailyRevenueForm(prev => ({ ...prev, note: event.target.value }))}
                placeholder="İsteğe bağlı kapanış notu"
              />
            </label>

            <div className="daily-total-card">
              <span>Toplam Ciro</span>
              <strong>{formatPrice(dailyRevenueTotal)}</strong>
            </div>

            {dailyRevenueStatus && <p className="status">{dailyRevenueStatus}</p>}

            <div className="form-actions">
              <button type="submit" disabled={dailyRevenueSaving}>
                <Save size={18} /> {dailyRevenueSaving ? "Kaydediliyor" : "Kapanışı Kaydet"}
              </button>
              <button type="button" onClick={resetDailyRevenueForm}>Temizle</button>
            </div>
          </form>

          <section className="product-admin-list daily-revenue-list">
            <div className="daily-revenue-list-head">
              <div>
                <h2>Son 10 Gün</h2>
                <p>Kayıtlı gün sonu ciro kapanışları</p>
              </div>
              <button onClick={loadDailyRevenues}>Yenile</button>
            </div>

            {dailyRevenues.length === 0 && <p className="empty">Henüz gün sonu kaydı yok.</p>}

            <div className="daily-revenue-table">
              {dailyRevenues.length > 0 && (
                <div className="daily-revenue-row daily-revenue-header">
                  <span>Tarih</span>
                  <span>Nakit</span>
                  <span>Kart</span>
                  <span>Diğer</span>
                  <span>Toplam</span>
                  <span>Not</span>
                </div>
              )}

              {dailyRevenues.map(record => (
                <div className="daily-revenue-row" key={record.id}>
                  <span>{parseDateOnly(record.revenue_date).toLocaleDateString("tr-TR")}</span>
                  <span>{formatPrice(record.cash_amount)}</span>
                  <span>{formatPrice(record.card_amount)}</span>
                  <span>{formatPrice(record.other_amount)}</span>
                  <strong>{formatPrice(record.total_amount)}</strong>
                  <em>{record.note || "-"}</em>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    );
  }

  if (screen === "expiry-tracking") {
    return (
      <div className="app expiry-management">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>SKT Takip</h1>
            <p>Son kullanma tarihi yaklaşan ürünler</p>
          </div>
        </header>

        <section className="expiry-summary">
          <div><CalendarClock /><span>7 gün içinde</span><b>{expirySummary.approaching}</b></div>
          <div className="expired"><AlertTriangle /><span>Tarihi geçen</span><b>{expirySummary.expired}</b></div>
        </section>

        <section className="product-admin-layout expiry-admin-layout">
          <form className="product-form expiry-form" onSubmit={saveExpiryItem}>
            <h2>{editingExpiryId ? "Kaydı Düzenle" : "Ürün Ekle"}</h2>

            <label>
              Ürün adı
              <input
                value={expiryForm.product_name}
                onChange={event => setExpiryForm(prev => ({ ...prev, product_name: event.target.value }))}
                placeholder="Örn. Süt"
              />
            </label>

            <div className="form-grid">
              <label>
                Adet
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={expiryForm.quantity}
                  onChange={event => setExpiryForm(prev => ({ ...prev, quantity: event.target.value }))}
                />
              </label>
              <label>
                Konum
                <select
                  value={expiryForm.location}
                  onChange={event => setExpiryForm(prev => ({ ...prev, location: event.target.value }))}
                >
                  <option>Dolap</option>
                  <option>Depo</option>
                  <option>Tezgah</option>
                </select>
              </label>
            </div>

            <label>
              Son kullanma tarihi
              <input
                type="date"
                value={expiryForm.expiry_date}
                onChange={event => setExpiryForm(prev => ({ ...prev, expiry_date: event.target.value }))}
              />
            </label>

            <label>
              Not
              <textarea
                value={expiryForm.note}
                onChange={event => setExpiryForm(prev => ({ ...prev, note: event.target.value }))}
                placeholder="İsteğe bağlı not"
              />
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={expiryForm.active}
                onChange={event => setExpiryForm(prev => ({ ...prev, active: event.target.checked }))}
              />
              Aktif kayıt
            </label>

            {expiryStatus && <p className="status">{expiryStatus}</p>}
            <div className="form-actions">
              <button type="submit" disabled={expirySaving}>
                <Save size={18} /> {expirySaving ? "Kaydediliyor" : "Kaydet"}
              </button>
              <button type="button" onClick={resetExpiryForm}>Temizle</button>
            </div>
          </form>

          <section className="expiry-list">
            {sortedExpiryItems.length === 0 && <p className="empty">Henüz SKT kaydı yok.</p>}
            {sortedExpiryItems.map(item => {
              const daysLeft = getExpiryDaysLeft(item.expiry_date);
              return (
                <article className={`expiry-row ${getExpiryTone(daysLeft)} ${item.active === false ? "inactive" : ""}`} key={item.id}>
                  <div className="expiry-row-head">
                    <div>
                      <strong>{item.product_name}</strong>
                      <span>{item.quantity} adet · {item.location}</span>
                    </div>
                    <b>{getExpiryLabel(daysLeft)}</b>
                  </div>
                  <div className="expiry-row-meta">
                    <span>SKT: {parseDateOnly(item.expiry_date).toLocaleDateString("tr-TR")}</span>
                    <em>{item.active === false ? "Pasif" : "Aktif"}</em>
                  </div>
                  {item.note && <p>{item.note}</p>}
                  <div className="product-row-actions">
                    <button onClick={() => editExpiryItem(item)}>Düzenle</button>
                    <button onClick={() => toggleExpiryActive(item)}>
                      {item.active === false ? "Aktif Yap" : "Pasif Yap"}
                    </button>
                  </div>
                </article>
              );
            })}
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

  if (screen === "order-history") {
    return (
      <div className="app order-history-page">
        <header className="topbar">
          <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
          <div>
            <h1>Sipariş Geçmişi</h1>
            <p>Tamamlanan ve iptal edilen siparişler</p>
          </div>
        </header>

        <section className="history-toolbar">
          <div className="history-filter-group">
            {[
              { value: "today", label: "Bugün" },
              { value: "yesterday", label: "Dün" },
              { value: "last7", label: "Son 7 gün" },
              { value: "custom", label: "Özel tarih" }
            ].map(option => (
              <button
                key={option.value}
                className={historyFilter === option.value ? "active" : ""}
                onClick={() => loadOrderHistory(option.value, historyDate)}
                disabled={historyLoading}
              >
                {option.label}
              </button>
            ))}
          </div>

          {historyFilter === "custom" && (
            <input
              type="date"
              value={historyDate}
              onChange={event => loadOrderHistory("custom", event.target.value)}
              disabled={historyLoading}
            />
          )}

          <label className="search-box history-search">
            <Search size={18} />
            <input
              value={historySearchTerm}
              onChange={event => setHistorySearchTerm(event.target.value)}
              placeholder="Masa, ürün veya not ara"
            />
          </label>
        </section>

        {historyStatus && <p className="status">{historyStatus}</p>}

        <section className="history-list">
          {historyLoading && <p className="empty history-empty">Sipariş geçmişi yükleniyor...</p>}

          {!historyLoading && filteredHistoryOrders.length === 0 && (
            <p className="empty history-empty">Seçilen filtrede sipariş geçmişi yok.</p>
          )}

          {!historyLoading && filteredHistoryOrders.map(order => (
            <article className={`history-card ${order.status === "cancelled" ? "cancelled" : "completed"}`} key={order.id}>
              <div className="history-card-head">
                <div>
                  <strong>{order.table_name || "Masa yok"}</strong>
                  <span>
                    {new Date(order.created_at).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
                <div>
                  <em>{order.status}</em>
                  <b>{formatPrice(order.total_price)}</b>
                </div>
              </div>

              {order.note && (
                <p className="history-note">{order.note}</p>
              )}

              <div className="history-items">
                {(order.items || []).length === 0 && <p className="empty">Ürün kaydı yok.</p>}
                {(order.items || []).map(item => (
                  <div className="history-item" key={`${order.id}-${item.product_name}`}>
                    <span>
                      {getWeightedBaseName({ name: item.product_name })}
                      <small>{Number(item.quantity || 0)} x {formatPrice(item.unit_price)}</small>
                    </span>
                    <b>{formatPrice(item.total_price)}</b>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="app order-layout">
      <header className="order-header">
        <button className="back" onClick={() => setScreen("tables")}><ArrowLeft /></button>
        <div>
          <h1>{selectedTable}</h1>
          <p>{cartItems.length} ürün</p>
        </div>
        <strong>{formatPrice(total)}</strong>
      </header>

      <div className="order-filter-panel">
        <div className="category-row">
          {categories.map(c => (
            <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Ürün ara"
          />
        </label>
      </div>

      <main className="order-main">
        <section className="products">
          {filteredProducts.length === 0 && <p className="empty products-empty">Ürün bulunamadı.</p>}

          {filteredProducts.map(product => {
            const qty = cart[product.name]?.quantity || 0;
            return (
              <button
                className={`product-card quick-add-card ${product.favorite === true ? "is-favorite" : ""}`}
                key={product.name}
                onClick={() => handleProductPress(product)}
                onPointerDown={() => startFavoriteLongPress(product)}
                onPointerUp={cancelFavoriteLongPress}
                onPointerLeave={cancelFavoriteLongPress}
                onPointerCancel={cancelFavoriteLongPress}
                onContextMenu={event => {
                  event.preventDefault();
                  if (longPressTriggered.current) return;
                  toggleProductFavorite(product, { source: "order" });
                }}
              >
                <div>
                  <strong>{product.name}</strong>
                  <b>{formatPrice(product.price)}{product.unit_type === "weighted" ? " / kg" : ""}</b>
                </div>
                {product.favorite === true && <span className="favorite-dot"><Star size={13} fill="currentColor" /></span>}
                <span className="add-dot">+</span>
                {qty > 0 && <em className="product-qty">{qty}</em>}
              </button>
            );
          })}
        </section>

        {mobileCartOpen && <button className="mobile-cart-backdrop" onClick={() => setMobileCartOpen(false)} aria-label="Adisyonu kapat" />}

        <aside className={`cart ${mobileCartOpen ? "mobile-open" : ""}`}>
          <div className="cart-head">
            <div>
              <h2>Adisyon</h2>
              <span>{selectedTable} · {cartItems.length} ürün</span>
            </div>
            <button className="cart-close" onClick={() => setMobileCartOpen(false)}>Kapat</button>
          </div>

          {cartItems.length === 0 && <p className="empty">Henüz ürün yok.</p>}

          {cartItems.map(item => (
            <div className="cart-line" key={item.name}>
              <span>
                {isWeightedCartItem(item) ? getWeightedBaseName(item) : item.name}
                <small>
                  {isWeightedCartItem(item)
                    ? `${formatPrice(item.price)} · ≈${Number(item.grams || 0) * item.quantity} g`
                    : `${item.quantity} x ${item.price} ₺`}
                </small>
              </span>
              <div className="cart-line-actions">
                <button onClick={() => {
                  if (isWeightedCartItem(item)) deleteCartItem(item.name);
                  else removeProduct(item.product);
                }}>-</button>
                <em>{item.quantity}</em>
                {!isWeightedCartItem(item) && (
                  <button onClick={() => addProduct(item.product)}>+</button>
                )}
                <button className="danger" onClick={() => deleteCartItem(item.name)}>Sil</button>
              </div>
              <b>{formatPrice(item.quantity * item.price)}</b>
            </div>
          ))}

          <button className="note-toggle" onClick={() => setOrderNoteOpen(prev => !prev)}>
            {orderNoteOpen || orderNote ? "Notu Gizle" : "Not Ekle"}
          </button>

          {(orderNoteOpen || orderNote) && (
            <label className="order-note">
              Sipariş Notu
              <textarea
                value={orderNote}
                onChange={event => {
                  setOrderNote(event.target.value);
                  setAutoSaveVersion(version => version + 1);
                }}
                placeholder="açık çay, şekersiz, ısıtılacak, paket olsun"
                rows={3}
              />
            </label>
          )}

          <div className="total">
            <span>Toplam</span>
            <strong>{formatPrice(total)}</strong>
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

          <button className="pay" onClick={() => saveOrder(true)}>
            <CreditCard size={18} /> Ödeme Al
          </button>
        </aside>
      </main>

      <div className="mobile-cart-bar">
        <div>
          <span>Toplam</span>
          <strong>{formatPrice(total)}</strong>
          <small>{cartItems.length} ürün</small>
        </div>
        <button className="mobile-pay-button" onClick={() => saveOrder(true)}>
          Ödeme Al
        </button>
        <button className="mobile-detail-button" onClick={() => setMobileCartOpen(true)}>
          Adisyonu Gör
        </button>
      </div>

      {weightedProduct && (
        <div className="weighted-overlay">
          <div className="weighted-sheet">
            <div>
              <h2>{weightedProduct.name}</h2>
              <p>{formatPrice(weightedProduct.price)}/kg</p>
            </div>

            <label>
              Tutar
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={weightedAmount}
              onChange={event => setWeightedAmount(event.target.value)}
              placeholder="Örn. 200"
              autoFocus
            />

            <strong>
              Yaklaşık {Number(weightedProduct.price || 0) > 0 && Number(weightedAmount || 0) > 0
                ? Math.round((Number(weightedAmount || 0) / Number(weightedProduct.price || 0)) * 1000)
                : 0} g
            </strong>

            <div className="weighted-actions">
              <button onClick={() => {
                setWeightedProduct(null);
                setWeightedAmount("");
              }}>Vazgeç</button>
              <button onClick={confirmWeightedProduct}>Adisyona Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
