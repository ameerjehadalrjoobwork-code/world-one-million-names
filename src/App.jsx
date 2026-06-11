import { useEffect, useMemo, useRef, useState } from "react";
import PixelCanvas from "./components/PixelCanvas";
import { supabase } from "./lib/supabase";
import "./App.css";

const GRID_SIZE = 100;
const CELLS_PER_PAGE = GRID_SIZE * GRID_SIZE;
const TOTAL_PAGES = 100;
const TOTAL_CELLS = CELLS_PER_PAGE * TOTAL_PAGES;
const PRICE = 5;
const BUCKET_NAME = "pixel-images";

const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || "admin";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

function getPageFromCellId(cellId) {
  return Math.ceil(cellId / CELLS_PER_PAGE);
}

function getLocalIndex(cellId) {
  return (cellId - 1) % CELLS_PER_PAGE;
}

function getRowColFromCellId(cellId) {
  const localIndex = getLocalIndex(cellId);

  return {
    row: Math.floor(localIndex / GRID_SIZE),
    col: localIndex % GRID_SIZE,
  };
}

function getFileExtension(file) {
  const fallback = "jpg";
  const fromName = file.name?.split(".").pop()?.toLowerCase();

  if (!fromName) return fallback;

  return fromName.replace(/[^a-z0-9]/g, "") || fallback;
}

function formatDate(value) {
  if (!value) return "غير معروف";

  try {
    return new Date(value).toLocaleString("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function getStatusLabel(status) {
  if (status === "pending_payment") return "بانتظار الدفع";
  if (status === "pending") return "قيد مراجعة الصورة";
  if (status === "approved") return "موافق عليه";
  if (status === "rejected") return "مرفوض";
  return status || "غير معروف";
}

function getStatusClass(status) {
  if (status === "approved") return "approved";
  if (status === "pending") return "pending";
  if (status === "pending_payment") return "pendingPayment";
  if (status === "rejected") return "rejected";
  return "";
}

function getHashParams(hash) {
  const query = hash.includes("?") ? hash.split("?")[1] : "";
  return new URLSearchParams(query);
}

function compressImage(file, maxSize = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("فشل قراءة الصورة"));

    img.onload = () => {
      let { width, height } = img;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("فشل تجهيز الصورة"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("فشل ضغط الصورة"));
            return;
          }

          const compressedFile = new File([blob], file.name || "image.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => reject(new Error("فشل تحميل الصورة"));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash || "");

  useEffect(() => {
    function handleHashChange() {
      setRoute(window.location.hash || "");
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (route.startsWith("#admin")) {
    return <AdminPage />;
  }

  if (route.startsWith("#payment-success")) {
    const params = getHashParams(route);

    return (
      <PaymentResult
        type="success"
        cellId={params.get("cellId")}
      />
    );
  }

  if (route.startsWith("#payment-cancel")) {
    const params = getHashParams(route);

    return (
      <PaymentResult
        type="cancel"
        cellId={params.get("cellId")}
      />
    );
  }

  return <PublicBoard />;
}

function PaymentResult({ type, cellId }) {
  const isSuccess = type === "success";

  function goHome() {
    window.location.hash = "";
  }

  function goAdmin() {
    window.location.hash = "admin";
  }

  return (
    <main className="resultPage">
      <section className={`resultCard ${isSuccess ? "success" : "cancel"}`}>
        <span className="resultIcon">{isSuccess ? "✓" : "!"}</span>

        <h1>{isSuccess ? "تم الرجوع من صفحة الدفع" : "تم إلغاء الدفع"}</h1>

        <p>
          {isSuccess
            ? "وصل المستخدم من Togo بعد عملية الدفع. سيبقى الطلب بانتظار تأكيد الإدارة ثم الموافقة على الصورة قبل الظهور."
            : "لم تكتمل عملية الدفع. يمكن للمستخدم الرجوع للموقع والمحاولة مرة أخرى."}
        </p>

        {cellId && <strong>رقم المربع: #{cellId}</strong>}

        <div className="resultActions">
          <button onClick={goHome}>الرجوع للوحة</button>
          <button onClick={goAdmin}>دخول المدير</button>
        </div>
      </section>
    </main>
  );
}

function PublicBoard() {
  const canvasRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [soldCells, setSoldCells] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const [buyCell, setBuyCell] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);

  const [zoomPercent, setZoomPercent] = useState(100);
  const [pageInput, setPageInput] = useState("1");
  const [cellSearch, setCellSearch] = useState("");

  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalApprovedCount, setTotalApprovedCount] = useState(0);

  const pageReservedCount = useMemo(() => {
    return Object.keys(soldCells).length;
  }, [soldCells]);

  const progressPercent = useMemo(() => {
    return Math.min(100, (totalApprovedCount / TOTAL_CELLS) * 100);
  }, [totalApprovedCount]);

  useEffect(() => {
    loadPageCells(currentPage);
    loadTotalApprovedCount();
  }, [currentPage]);

  async function loadPageCells(page) {
    setIsLoadingPage(true);

    const { data, error } = await supabase
      .from("pixel_cells")
      .select("id,status,owner_name,city,description,image_url,page_number,created_at")
      .eq("page_number", page)
      .in("status", ["approved", "pending", "pending_payment"]);

    if (error) {
      console.error(error);
      alert("صار خطأ أثناء تحميل بيانات الصفحة من Supabase");
      setIsLoadingPage(false);
      return;
    }

    const nextSoldCells = {};

    for (const row of data || []) {
      const isApproved = row.status === "approved";

      nextSoldCells[row.id] = {
        status: row.status,
        ownerName: isApproved ? row.owner_name || "" : "",
        city: isApproved ? row.city || "" : "",
        description: isApproved ? row.description || "" : "",
        imageUrl: isApproved ? row.image_url || "" : "",
        page: row.page_number,
        createdAt: row.created_at,
      };
    }

    setSoldCells(nextSoldCells);
    setIsLoadingPage(false);
  }

  async function loadTotalApprovedCount() {
    const { count, error } = await supabase
      .from("pixel_cells")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "approved");

    if (error) {
      console.error(error);
      return;
    }

    setTotalApprovedCount(count || 0);
  }

  function openBuyModal(cellId) {
    setBuyCell({
      id: cellId,
      page: getPageFromCellId(cellId),
      ownerName: "",
      city: "",
      description: "",
      buyerEmail: "",
      buyerPhone: "",
      imagePreviewUrl: "",
      file: null,
    });
  }

  function handleCanvasCellClick(cellId) {
    const cellData = soldCells[cellId];

    if (cellData?.status === "approved") {
      setSelectedCell({
        id: cellId,
        ...cellData,
      });
      return;
    }

    if (cellData?.status === "pending") {
      alert("هذا المربع محجوز وينتظر موافقة الإدارة.");
      return;
    }

    if (cellData?.status === "pending_payment") {
      alert("هذا المربع محجوز وينتظر تأكيد الدفع.");
      return;
    }

    openBuyModal(cellId);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const imagePreviewUrl = URL.createObjectURL(file);

    setBuyCell((prev) => ({
      ...prev,
      file,
      imagePreviewUrl,
    }));
  }

  async function uploadImageToSupabase(file, cellId, pageNumber) {
    const extension = getFileExtension(file);
    const filePath = `page-${pageNumber}/cell-${cellId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("لم يتم إنشاء رابط الصورة");
    }

    return data.publicUrl;
  }

  async function confirmBuy(e) {
    e.preventDefault();

    if (!buyCell.ownerName.trim()) {
      alert("اكتب الاسم");
      return;
    }

    if (!buyCell.buyerEmail.trim()) {
      alert("اكتب البريد الإلكتروني");
      return;
    }

    if (!buyCell.buyerPhone.trim()) {
      alert("اكتب رقم الهاتف");
      return;
    }

    if (!buyCell.file) {
      alert("ارفع صورة");
      return;
    }

    setIsSaving(true);

    try {
      const cellId = Number(buyCell.id);
      const pageNumber = getPageFromCellId(cellId);
      const { row, col } = getRowColFromCellId(cellId);

      const optimizedFile = await compressImage(buyCell.file);
      const imageUrl = await uploadImageToSupabase(optimizedFile, cellId, pageNumber);

      const { data, error } = await supabase.functions.invoke("create-togo-payment", {
        body: {
          cellId,
          pageNumber,
          row,
          col,
          ownerName: buyCell.ownerName.trim(),
          city: buyCell.city.trim(),
          description: buyCell.description.trim(),
          imageUrl,
          buyerEmail: buyCell.buyerEmail.trim(),
          buyerPhone: buyCell.buyerPhone.trim(),
        },
      });

      if (error) {
        throw new Error(error.message || "فشل إنشاء طلب الدفع");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.paymentUrl) {
        throw new Error("لم يرجع رابط الدفع من Togo");
      }

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error(error);
      alert(error.message || "صار خطأ أثناء إنشاء طلب الدفع");
      setIsSaving(false);
    }
  }

  function goToPage(page) {
    const safePage = Math.min(TOTAL_PAGES, Math.max(1, Number(page) || 1));

    setCurrentPage(safePage);
    setPageInput(String(safePage));
    setMobilePanel(null);

    requestAnimationFrame(() => {
      canvasRef.current?.reset?.();
    });
  }

  function reserveFirstEmpty() {
    const start = (currentPage - 1) * CELLS_PER_PAGE + 1;
    const end = currentPage * CELLS_PER_PAGE;

    for (let id = start; id <= end; id++) {
      if (!soldCells[id]) {
        openBuyModal(id);
        return;
      }
    }

    alert("هذه الصفحة ممتلئة");
  }

  function handleSearchCell(e) {
    e.preventDefault();

    const cellId = Number(cellSearch);

    if (!cellId || cellId < 1 || cellId > TOTAL_CELLS) {
      alert(`اكتب رقم مربع من 1 إلى ${TOTAL_CELLS.toLocaleString("en-US")}`);
      return;
    }

    const targetPage = getPageFromCellId(cellId);

    setCurrentPage(targetPage);
    setPageInput(String(targetPage));
    setMobilePanel(null);

    setTimeout(() => {
      canvasRef.current?.goToCell?.(cellId);
    }, 80);
  }

  return (
    <main className="appShell">
      <div className="mobileTopCounter">
        <span>المليون مربع</span>

        <strong>
          {totalApprovedCount.toLocaleString("en-US")} / {TOTAL_CELLS.toLocaleString("en-US")}
        </strong>

        <div>
          <b style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mobileBottomDock">
        <button type="button" onClick={reserveFirstEmpty}>
          ＋
          <span>حجز</span>
        </button>

        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
          <span>السابق</span>
        </button>

        <button type="button" onClick={() => setMobilePanel("page")}>
          {currentPage}
          <span>صفحة</span>
        </button>

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === TOTAL_PAGES}
        >
          ›
          <span>التالي</span>
        </button>

        <button type="button" onClick={() => setMobilePanel("search")}>
          🔎
          <span>بحث</span>
        </button>

        <a href="#admin">
          ⚙
          <span>مدير</span>
        </a>
      </div>

      <aside className="sidebar">
        <div className="brand">
          <span className="logoBox"></span>

          <div>
            <h1>مليون مربع فلسطيني</h1>
            <p>كل مربع له صاحب، صورة، قصة، ومكان ثابت على اللوحة.</p>
          </div>
        </div>

        <div className="millionProgressCard">
          <div className="progressTop">
            <span>عدد المربعات من المليون</span>

            <strong>
              {totalApprovedCount.toLocaleString("en-US")} / {TOTAL_CELLS.toLocaleString("en-US")}
            </strong>
          </div>

          <div className="progressTrack">
            <div
              className="progressFill"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>

          <p>كل مربع يتم اعتماده يضيف اسماً جديداً إلى اللوحة.</p>
        </div>

        <div className="priceGoldCard">
          <span>سعر المربع</span>
          <strong>{PRICE} شيكل</strong>
        </div>

        <button className="primaryBtn" onClick={reserveFirstEmpty}>
          احجز أول مربع فارغ
        </button>

        <div className="pageBox">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            السابق
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToPage(pageInput);
            }}
          >
            <span>الصفحة</span>

            <div className="pageInputRow">
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                inputMode="numeric"
              />

              <small>/ {TOTAL_PAGES}</small>
            </div>
          </form>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === TOTAL_PAGES}
          >
            التالي
          </button>
        </div>

        <div className="sidebarBottomBox">
          <a className="adminLink" href="#admin">
            دخول المدير
          </a>

          <p>اسحب اللوحة بالماوس. استخدم عجلة الماوس للتكبير والتصغير.</p>
        </div>

        <form className="searchBox" onSubmit={handleSearchCell}>
          <label>اذهب إلى رقم مربع</label>

          <div>
            <button>اذهب</button>

            <input
              value={cellSearch}
              onChange={(e) => setCellSearch(e.target.value)}
              placeholder="مثلاً 12500"
              inputMode="numeric"
            />
          </div>
        </form>
      </aside>

      <section className="boardSection">
        <header className="boardHeader">
          <div>
            <h2>لوحة رقم {currentPage}</h2>
            <p>
              الأرقام تصاعدية من اليمين إلى اليسار. المحجوز يظهر بدون بيانات حتى الموافقة.
            </p>
          </div>

          <div className="toolbar">
            <button type="button" onClick={() => canvasRef.current?.zoomIn?.()}>
              +
            </button>

            <span>{zoomPercent}%</span>

            <button type="button" onClick={() => canvasRef.current?.zoomOut?.()}>
              -
            </button>

            <button type="button" onClick={() => canvasRef.current?.reset?.()}>
              البداية
            </button>
          </div>
        </header>

        <PixelCanvas
          ref={canvasRef}
          currentPage={currentPage}
          soldCells={soldCells}
          onCellClick={handleCanvasCellClick}
          onCameraChange={(camera) => {
            setZoomPercent(Math.round(camera.scale * 100));
          }}
        />
      </section>

      {mobilePanel && (
        <div className="mobileSheetOverlay" onClick={() => setMobilePanel(null)}>
          <div className="mobileSheet" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mobileSheetClose"
              onClick={() => setMobilePanel(null)}
            >
              ×
            </button>

            {mobilePanel === "page" && (
              <>
                <h3>تغيير الصفحة</h3>

                <form
                  className="mobileSearchForm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    goToPage(pageInput);
                  }}
                >
                  <label>رقم الصفحة</label>

                  <input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    inputMode="numeric"
                    placeholder="مثلاً 2"
                  />

                  <button type="submit">اذهب إلى الصفحة</button>
                </form>
              </>
            )}

            {mobilePanel === "search" && (
              <>
                <h3>البحث عن مربع</h3>

                <form className="mobileSearchForm" onSubmit={handleSearchCell}>
                  <label>رقم المربع</label>

                  <input
                    value={cellSearch}
                    onChange={(e) => setCellSearch(e.target.value)}
                    placeholder="مثلاً 12500"
                    inputMode="numeric"
                  />

                  <button type="submit">اذهب إلى المربع</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {selectedCell && (
        <div className="modalOverlay" onClick={() => setSelectedCell(null)}>
          <div className="modal detailsModal" onClick={(e) => e.stopPropagation()}>
            <button className="closeBtn" onClick={() => setSelectedCell(null)}>
              ×
            </button>

            <span className="modalBadge">مربع #{selectedCell.id}</span>

            <img className="detailsImage" src={selectedCell.imageUrl} alt="" />

            <h2>{selectedCell.ownerName}</h2>

            <p className="muted">📍 {selectedCell.city || "فلسطين"}</p>

            <p className="description">
              {selectedCell.description || "لا يوجد وصف لهذا المربع بعد."}
            </p>

            <p className="dateText">تاريخ الإضافة: {formatDate(selectedCell.createdAt)}</p>
          </div>
        </div>
      )}

      {buyCell && (
        <div className="modalOverlay" onClick={() => !isSaving && setBuyCell(null)}>
          <form
            className="modal buyModal"
            onSubmit={confirmBuy}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="closeBtn"
              disabled={isSaving}
              onClick={() => setBuyCell(null)}
            >
              ×
            </button>

            <span className="modalBadge">حجز مربع #{buyCell.id}</span>

            <h2>ارفع صورتك واحجز مكانك</h2>

            <input
              type="text"
              placeholder="الاسم"
              value={buyCell.ownerName}
              disabled={isSaving}
              onChange={(e) =>
                setBuyCell((prev) => ({
                  ...prev,
                  ownerName: e.target.value,
                }))
              }
            />

            <input
              type="text"
              placeholder="المدينة"
              value={buyCell.city}
              disabled={isSaving}
              onChange={(e) =>
                setBuyCell((prev) => ({
                  ...prev,
                  city: e.target.value,
                }))
              }
            />

            <textarea
              placeholder="وصف قصير"
              value={buyCell.description}
              disabled={isSaving}
              onChange={(e) =>
                setBuyCell((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />

            <input
              type="email"
              placeholder="البريد الإلكتروني للدفع"
              value={buyCell.buyerEmail}
              disabled={isSaving}
              onChange={(e) =>
                setBuyCell((prev) => ({
                  ...prev,
                  buyerEmail: e.target.value,
                }))
              }
            />

            <input
              type="tel"
              placeholder="رقم الهاتف"
              value={buyCell.buyerPhone}
              disabled={isSaving}
              onChange={(e) =>
                setBuyCell((prev) => ({
                  ...prev,
                  buyerPhone: e.target.value,
                }))
              }
            />

            <label className="uploadBox">
              {buyCell.imagePreviewUrl ? (
                <img src={buyCell.imagePreviewUrl} alt="preview" />
              ) : (
                <div>
                  <strong>اضغط لرفع الصورة</strong>
                  <span>JPG / PNG / WEBP</span>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                hidden
                disabled={isSaving}
                onChange={handleImageUpload}
              />
            </label>

            <button className="buyBtn" type="submit" disabled={isSaving}>
              {isSaving ? "جاري تجهيز الدفع..." : `ادفع ${PRICE} شيكل عبر Togo`}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function AdminPage() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState(ADMIN_USERNAME);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending_payment");
  const [adminSearch, setAdminSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [counts, setCounts] = useState({
    pending_payment: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    loadAdminData(statusFilter);
  }, [session, statusFilter]);

  const filteredRequests = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();

    if (!search) return requests;

    return requests.filter((item) => {
      return (
        String(item.id).includes(search) ||
        String(item.owner_name || "").toLowerCase().includes(search) ||
        String(item.city || "").toLowerCase().includes(search) ||
        String(item.description || "").toLowerCase().includes(search) ||
        String(item.buyer_email || "").toLowerCase().includes(search) ||
        String(item.buyer_phone || "").toLowerCase().includes(search)
      );
    });
  }, [requests, adminSearch]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    if (!ADMIN_EMAIL) {
      setLoginError("لازم تضيف VITE_ADMIN_EMAIL داخل ملف .env.local");
      return;
    }

    if (username.trim() !== ADMIN_USERNAME) {
      setLoginError("اسم المستخدم غير صحيح");
      return;
    }

    if (!password.trim()) {
      setLoginError("اكتب كلمة السر");
      return;
    }

    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });

    setIsLoggingIn(false);

    if (error) {
      console.error(error);
      setLoginError("كلمة السر غير صحيحة أو المستخدم غير موجود في Supabase Auth");
      return;
    }

    setSession(data.session || null);
    setPassword("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function loadCounts() {
    const statuses = ["pending_payment", "pending", "approved", "rejected"];

    const nextCounts = {
      pending_payment: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const status of statuses) {
      const { count, error } = await supabase
        .from("pixel_cells")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", status);

      if (!error) {
        nextCounts[status] = count || 0;
      }
    }

    setCounts(nextCounts);
  }

  async function loadAdminData(nextStatus = statusFilter) {
    setIsLoading(true);

    let query = supabase
      .from("pixel_cells")
      .select("*")
      .order("created_at", { ascending: false });

    if (nextStatus !== "all") {
      query = query.eq("status", nextStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      alert("صار خطأ أثناء تحميل طلبات المدير.");
      setIsLoading(false);
      return;
    }

    setRequests(data || []);
    await loadCounts();
    setIsLoading(false);
  }

  async function confirmPayment(item) {
    if (!window.confirm(`تأكيد الدفع للمربع #${item.id}؟`)) return;

    setBusyId(item.id);

    const { error } = await supabase
      .from("pixel_cells")
      .update({
        status: "pending",
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشل تأكيد الدفع");
      return;
    }

    await loadAdminData(statusFilter);
  }

  async function approveRequest(item) {
    if (!window.confirm(`الموافقة على ظهور المربع #${item.id}؟`)) return;

    setBusyId(item.id);

    const { error } = await supabase
      .from("pixel_cells")
      .update({
        status: "approved",
      })
      .eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشل قبول الطلب");
      return;
    }

    await loadAdminData(statusFilter);
  }

  async function rejectRequest(item) {
    if (!window.confirm(`رفض الطلب للمربع #${item.id}؟`)) return;

    setBusyId(item.id);

    const { error } = await supabase
      .from("pixel_cells")
      .update({
        status: "rejected",
      })
      .eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشل رفض الطلب");
      return;
    }

    await loadAdminData(statusFilter);
  }

  async function deleteRequest(item) {
    if (!window.confirm(`حذف الطلب وإفراغ المربع #${item.id}؟`)) return;

    setBusyId(item.id);

    const { error } = await supabase
      .from("pixel_cells")
      .delete()
      .eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشل حذف الطلب");
      return;
    }

    await loadAdminData(statusFilter);
  }

  if (!session) {
    return (
      <main className="adminLoginPage">
        <form className="adminLoginCard" onSubmit={handleLogin}>
          <a className="backHome" href="#">
            الرجوع للوحة
          </a>

          <h1>دخول المدير</h1>

          <p>هذه الصفحة مخصصة لإدارة الطلبات وتأكيد الدفع والموافقة على الصور.</p>

          <label>
            اسم المستخدم
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label>
            كلمة السر
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {loginError && <div className="loginError">{loginError}</div>}

          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="adminPage">
      <header className="adminTop">
        <div>
          <a className="backHome" href="#">
            الرجوع للوحة
          </a>

          <h1>لوحة المدير</h1>

          <p>إدارة طلبات المربعات، تأكيد الدفع، والموافقة على ظهور الصور.</p>
        </div>

        <button className="logoutBtn" onClick={handleLogout}>
          تسجيل خروج
        </button>
      </header>

      <section className="adminStats">
        <button
          className={statusFilter === "pending_payment" ? "active" : ""}
          onClick={() => setStatusFilter("pending_payment")}
        >
          <strong>{counts.pending_payment}</strong>
          <span>بانتظار الدفع</span>
        </button>

        <button
          className={statusFilter === "pending" ? "active" : ""}
          onClick={() => setStatusFilter("pending")}
        >
          <strong>{counts.pending}</strong>
          <span>قيد المراجعة</span>
        </button>

        <button
          className={statusFilter === "approved" ? "active" : ""}
          onClick={() => setStatusFilter("approved")}
        >
          <strong>{counts.approved}</strong>
          <span>مقبول</span>
        </button>

        <button
          className={statusFilter === "rejected" ? "active" : ""}
          onClick={() => setStatusFilter("rejected")}
        >
          <strong>{counts.rejected}</strong>
          <span>مرفوض</span>
        </button>
      </section>

      <section className="adminControls">
        <input
          value={adminSearch}
          onChange={(e) => setAdminSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم المربع أو المدينة"
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending_payment">بانتظار الدفع</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">موافق عليه</option>
          <option value="rejected">مرفوض</option>
          <option value="all">كل الطلبات</option>
        </select>

        <button onClick={() => loadAdminData(statusFilter)} disabled={isLoading}>
          {isLoading ? "جاري التحميل..." : "تحديث"}
        </button>
      </section>

      <section className="requestsGrid">
        {filteredRequests.length === 0 && (
          <div className="emptyRequests">
            {isLoading ? "جاري تحميل الطلبات..." : "لا توجد طلبات حالياً"}
          </div>
        )}

        {filteredRequests.map((item) => (
          <article key={item.id} className="requestCard">
            <div className="requestImageWrap">
              {item.image_url ? (
                <img src={item.image_url} alt={item.owner_name || "request"} />
              ) : (
                <span>لا توجد صورة</span>
              )}

              <span className={`statusPill ${getStatusClass(item.status)}`}>
                {getStatusLabel(item.status)}
              </span>
            </div>

            <div className="requestBody">
              <div className="requestTitle">
                <h2>{item.owner_name || "بدون اسم"}</h2>
                <strong>#{item.id}</strong>
              </div>

              <p>الصفحة: {item.page_number || getPageFromCellId(item.id)}</p>
              <p>المدينة: {item.city || "غير محددة"}</p>
              <p>الوصف: {item.description || "لا يوجد وصف"}</p>
              <p>تاريخ الطلب: {formatDate(item.created_at)}</p>

              {item.payment_confirmed_at && (
                <p>تأكيد الدفع: {formatDate(item.payment_confirmed_at)}</p>
              )}

              {item.buyer_email && <p>الإيميل: {item.buyer_email}</p>}
              {item.buyer_phone && <p>الهاتف: {item.buyer_phone}</p>}

              <div className="requestActions">
                {item.status === "pending_payment" && (
                  <button
                    className="paymentBtn"
                    disabled={busyId === item.id}
                    onClick={() => confirmPayment(item)}
                  >
                    {busyId === item.id ? "..." : "تأكيد الدفع"}
                  </button>
                )}

                {item.status === "pending" && (
                  <button
                    className="approveBtn"
                    disabled={busyId === item.id}
                    onClick={() => approveRequest(item)}
                  >
                    {busyId === item.id ? "..." : "موافقة"}
                  </button>
                )}

                {item.status !== "approved" && (
                  <button
                    className="rejectBtn"
                    disabled={busyId === item.id}
                    onClick={() => rejectRequest(item)}
                  >
                    رفض
                  </button>
                )}

                <button
                  className="deleteBtn"
                  disabled={busyId === item.id}
                  onClick={() => deleteRequest(item)}
                >
                  حذف وإفراغ
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
