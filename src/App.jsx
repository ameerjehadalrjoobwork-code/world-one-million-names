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

function compressImage(file, maxSize = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result;
    };

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

    img.onerror = () => reject(new Error("فشل قراءة الصورة"));
    reader.onerror = () => reject(new Error("فشل تحميل الصورة"));
    reader.readAsDataURL(file);
  });
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
  if (status === "pending_payment") return "بانتظار الدفع عبر Togo";
  if (status === "pending") return "قيد مراجعة الصورة";
  if (status === "approved") return "موافق عليه";
  if (status === "rejected") return "مرفوض";
  return status || "غير معروف";
}

function getPaymentMethodLabel(method) {
  if (method === "togo") return "Togo";
  if (method === "jawwal_pay") return "Jawwal Pay";
  if (method === "palpay") return "PalPay";
  return method || "غير محدد";
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
    return <PaymentResult type="success" />;
  }

  if (route.startsWith("#payment-cancel")) {
    return <PaymentResult type="cancel" />;
  }

  return <PublicBoard />;
}

function PaymentResult({ type }) {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const cellId = params.get("cellId");

  const isSuccess = type === "success";

  return (
    <main className="paymentResultPage">
      <section className="paymentResultCard">
        <div className={isSuccess ? "resultIcon success" : "resultIcon cancel"}>
          {isSuccess ? "✓" : "×"}
        </div>

        <h1>{isSuccess ? "تم الرجوع من صفحة الدفع" : "تم إلغاء عملية الدفع"}</h1>

        {isSuccess ? (
          <p>
            تم إنشاء طلب الدفع للمربع #{cellId || "غير معروف"}. إذا تم الدفع بنجاح،
            سيبقى الطلب بانتظار تأكيد الدفع من لوحة المدير ثم مراجعة الصورة.
          </p>
        ) : (
          <p>
            لم تكتمل عملية الدفع للمربع #{cellId || "غير معروف"}. يمكنك الرجوع
            للموقع واختيار المربع من جديد.
          </p>
        )}

        <div className="paymentResultActions">
          <a href="#">الرجوع للموقع</a>
          <a href="#admin">دخول المدير</a>
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

    const { data: approvedData, error: approvedError } = await supabase
      .from("pixel_cells")
      .select("id,status,owner_name,city,description,image_url,page_number,created_at")
      .eq("page_number", page)
      .eq("status", "approved");

    const { data: pendingData, error: pendingError } = await supabase
      .from("pixel_cells")
      .select("id,status,page_number,created_at")
      .eq("page_number", page)
      .in("status", ["pending", "pending_payment"]);

    if (approvedError || pendingError) {
      console.error(approvedError || pendingError);
      alert("صار خطأ أثناء تحميل بيانات الصفحة من Supabase");
      setIsLoadingPage(false);
      return;
    }

    const nextSoldCells = {};

    for (const row of approvedData || []) {
      nextSoldCells[row.id] = {
        status: row.status,
        ownerName: row.owner_name || "",
        city: row.city || "",
        description: row.description || "",
        imageUrl: row.image_url || "",
        page: row.page_number,
        createdAt: row.created_at,
      };
    }

    for (const row of pendingData || []) {
      nextSoldCells[row.id] = {
        status: row.status,
        ownerName: "",
        city: "",
        description: "",
        imageUrl: "",
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
      imagePreviewUrl: "",
      file: null,
      buyerEmail: "",
      buyerPhone: "",
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

    if (cellData?.status === "pending" || cellData?.status === "pending_payment") {
      alert("هذا المربع محجوز وينتظر الدفع أو موافقة الإدارة.");
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

    if (!buyCell.file) {
      alert("ارفع صورتك");
      return;
    }

    if (!buyCell.buyerEmail.trim()) {
      alert("اكتب الإيميل لإتمام الدفع");
      return;
    }

    if (!buyCell.buyerPhone.trim()) {
      alert("اكتب رقم الهاتف");
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

      setSoldCells((prev) => ({
        ...prev,
        [cellId]: {
          status: "pending_payment",
          ownerName: "",
          city: "",
          description: "",
          imageUrl: "",
          page: pageNumber,
          createdAt: new Date().toISOString(),
        },
      }));

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error(error);
      alert(error.message || "صار خطأ أثناء إنشاء طلب الدفع");
    } finally {
      setIsSaving(false);
    }
  }

  function goToPage(page) {
    const safePage = Math.min(TOTAL_PAGES, Math.max(1, Number(page) || 1));

    setCurrentPage(safePage);
    setPageInput(String(safePage));

    requestAnimationFrame(() => {
      canvasRef.current?.reset();
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

    alert("هذه الصفحة ممتلئة أو بانتظار موافقات");
  }

  function handleSearchCell(e) {
    e.preventDefault();

    const cellId = Number(cellSearch);

    if (!cellId || cellId < 1 || cellId > TOTAL_CELLS) {
      alert(`اكتب رقم مربع من 1 إلى ${TOTAL_CELLS}`);
      return;
    }

    const targetPage = getPageFromCellId(cellId);

    setCurrentPage(targetPage);
    setPageInput(String(targetPage));

    requestAnimationFrame(() => {
      canvasRef.current?.goToCell(cellId);
    });
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logoBox"></span>
<div className="mobileTopBar">
  <div className="mobileProgressMini">
    <span>المليون مربع</span>

    <strong>
      {totalApprovedCount.toLocaleString("en-US")} / {TOTAL_CELLS.toLocaleString("en-US")}
    </strong>

    <div className="mobileProgressTrack">
      <div
        className="mobileProgressFill"
        style={{
          width: `${progressPercent}%`,
        }}
      />
    </div>
  </div>

  <div className="mobilePriceMini">
    <span>السعر</span>
    <strong>{PRICE} شيكل</strong>
  </div>
</div>

<div className="mobileActionRail">
  <button
    type="button"
    onClick={reserveFirstEmpty}
    aria-label="شراء مربع"
  >
    ＋
    <span>شراء</span>
  </button>

  <button
    type="button"
    onClick={() => setMobilePanel("page")}
    aria-label="تغيير الصفحة"
  >
    ١
    <span>صفحة</span>
  </button>

  <button
    type="button"
    onClick={() => setMobilePanel("search")}
    aria-label="بحث عن مربع"
  >
    🔎
    <span>بحث</span>
  </button>

  <a href="#admin" aria-label="دخول المدير">
    ⚙
    <span>مدير</span>
  </a>
</div>
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
        width: `${Math.min(100, (totalApprovedCount / TOTAL_CELLS) * 100)}%`,
      }}
    />
  </div>

  <p>
    كل مربع يتم اعتماده يضيف اسماً جديداً إلى اللوحة.
  </p>
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

        <div className="sidebarBottomBox">
  <a className="adminLink" href="#admin">
    دخول المدير
  </a>

  <p>
    اسحب اللوحة بالماوس. استخدم عجلة الماوس للتكبير والتصغير.
  </p>
</div>
          
      </aside>

      <section className="boardSection">
        <header className="boardHeader">
          <div>
            <h2>لوحة رقم {currentPage}</h2>
            <p>الأرقام تصاعدية من اليمين إلى اليسار.</p>
          </div>

          <div className="toolbar">
            <button onClick={() => canvasRef.current?.zoomIn()}>+</button>
            <span>{zoomPercent}%</span>
            <button onClick={() => canvasRef.current?.zoomOut()}>-</button>
            <button onClick={() => canvasRef.current?.reset()}>البداية</button>
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

          <div className="mobilePageControls">
            <button
              type="button"
              onClick={() => {
                goToPage(currentPage - 1);
                setMobilePanel(null);
              }}
              disabled={currentPage === 1}
            >
              السابق
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                goToPage(pageInput);
                setMobilePanel(null);
              }}
            >
              <label>رقم الصفحة</label>

              <div>
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  inputMode="numeric"
                />

                <span>/ {TOTAL_PAGES}</span>
              </div>

              <button type="submit">اذهب</button>
            </form>

            <button
              type="button"
              onClick={() => {
                goToPage(currentPage + 1);
                setMobilePanel(null);
              }}
              disabled={currentPage === TOTAL_PAGES}
            >
              التالي
            </button>
          </div>
        </>
      )}

      {mobilePanel === "search" && (
        <>
          <h3>البحث عن مربع</h3>

          <form
            className="mobileSearchForm"
            onSubmit={(e) => {
              handleSearchCell(e);
              setMobilePanel(null);
            }}
          >
            <label>اكتب رقم المربع</label>

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

            <label className="uploadBox">
              {buyCell.imagePreviewUrl ? (
                <img src={buyCell.imagePreviewUrl} alt="preview" />
              ) : (
                <div>
                  <strong>اضغط لرفع صورتك</strong>
                  <span>PNG / JPG / WEBP</span>
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

            <div className="togoBox">
              <strong>الدفع عبر Togo</strong>
              <p>
                بعد الضغط على الزر سيتم تحويلك إلى صفحة الدفع. السعر: {PRICE} شيكل.
              </p>
            </div>

            <input
              type="email"
              placeholder="الإيميل لإتمام الدفع"
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

            <button className="buyBtn" type="submit" disabled={isSaving}>
              {isSaving ? "جاري تجهيز الدفع، لا تغلق الصفحة..." : "ادفع الآن عبر Togo"}
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
        String(item.payment_method || "").toLowerCase().includes(search)
      );
    });
  }, [requests, adminSearch]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    if (!ADMIN_EMAIL) {
      setLoginError("لازم تضيف VITE_ADMIN_EMAIL داخل ملف .env");
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
      alert("صار خطأ أثناء تحميل طلبات المدير. تأكد من SQL والصلاحيات.");
      setIsLoading(false);
      return;
    }

    setRequests(data || []);
    await loadCounts();
    setIsLoading(false);
  }

  async function confirmPayment(item) {
    const ok = window.confirm(
      `تأكيد أن دفع Togo تم للمربع #${item.id}؟\nاستخدم هذا الزر فقط بعد التأكد من لوحة Togo.`
    );

    if (!ok) return;

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
    const ok = window.confirm(
      `الموافقة على مربع #${item.id} باسم ${item.owner_name || "بدون اسم"}؟`
    );

    if (!ok) return;

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
      alert("فشلت الموافقة على الطلب");
      return;
    }

    await loadAdminData(statusFilter);
  }

  async function rejectRequest(item) {
    const ok = window.confirm(
      `رفض الطلب وحذف مربع #${item.id}؟\nبعد الحذف يصبح المربع متاحاً للحجز مرة ثانية.`
    );

    if (!ok) return;

    setBusyId(item.id);

    const { error } = await supabase.from("pixel_cells").delete().eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشل رفض/حذف الطلب");
      return;
    }

    await loadAdminData(statusFilter);
  }

  async function returnToPendingPayment(item) {
    const ok = window.confirm(`إرجاع مربع #${item.id} إلى بانتظار الدفع؟`);
    if (!ok) return;

    setBusyId(item.id);

    const { error } = await supabase
      .from("pixel_cells")
      .update({
        status: "pending_payment",
        payment_confirmed_at: null,
      })
      .eq("id", item.id);

    setBusyId(null);

    if (error) {
      console.error(error);
      alert("فشلت العملية");
      return;
    }

    await loadAdminData(statusFilter);
  }

  if (!session) {
    return (
      <main className="adminLoginPage">
        <form className="adminLoginCard" onSubmit={handleLogin}>
          <div className="adminLoginLogo">■</div>

          <h1>دخول المدير</h1>
          <p>أدخل اسم المستخدم وكلمة السر لمراجعة طلبات Togo والصور.</p>

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

          {loginError && <div className="adminError">{loginError}</div>}

          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? "جاري الدخول..." : "دخول"}
          </button>

          <a href="#" className="backToSite">
            الرجوع للموقع
          </a>
        </form>
      </main>
    );
  }

  const totalAll =
    counts.pending_payment + counts.pending + counts.approved + counts.rejected;

  return (
    <main className="adminPage">
      <header className="adminHeader">
        <div>
          <h1>لوحة المدير</h1>
          <p>
            طلبات Togo تظهر أولاً بانتظار الدفع، ثم تراجع الصورة، وبعد الموافقة تظهر للزوار.
          </p>
        </div>

        <div className="adminHeaderActions">
          <a href="#">عرض الموقع</a>
          <button onClick={handleLogout}>تسجيل خروج</button>
        </div>
      </header>

      <section className="adminStats">
        <button
          className={statusFilter === "pending_payment" ? "active" : ""}
          onClick={() => setStatusFilter("pending_payment")}
        >
          <strong>{counts.pending_payment.toLocaleString("ar")}</strong>
          <span>بانتظار الدفع</span>
        </button>

        <button
          className={statusFilter === "pending" ? "active" : ""}
          onClick={() => setStatusFilter("pending")}
        >
          <strong>{counts.pending.toLocaleString("ar")}</strong>
          <span>قيد مراجعة الصورة</span>
        </button>

        <button
          className={statusFilter === "approved" ? "active" : ""}
          onClick={() => setStatusFilter("approved")}
        >
          <strong>{counts.approved.toLocaleString("ar")}</strong>
          <span>موافق عليه</span>
        </button>

        <button
          className={statusFilter === "all" ? "active" : ""}
          onClick={() => setStatusFilter("all")}
        >
          <strong>{totalAll.toLocaleString("ar")}</strong>
          <span>الكل</span>
        </button>
      </section>

      <section className="adminTools">
        <div>
          <label>بحث</label>
          <input
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="ابحث بالاسم، المدينة، رقم المربع، أو طريقة الدفع"
          />
        </div>

        <button onClick={() => loadAdminData(statusFilter)} disabled={isLoading}>
          {isLoading ? "جاري التحديث..." : "تحديث الطلبات"}
        </button>
      </section>

      {isLoading ? (
        <div className="adminEmpty">جاري تحميل الطلبات...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="adminEmpty">لا توجد طلبات في هذا القسم حالياً.</div>
      ) : (
        <section className="requestsGrid">
          {filteredRequests.map((item) => (
            <article key={item.id} className="requestCard">
              <div className="requestImageWrap">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.owner_name || ""} />
                ) : (
                  <span>لا توجد صورة</span>
                )}

                <b className={`statusBadge ${item.status}`}>
                  {getStatusLabel(item.status)}
                </b>
              </div>

              <div className="requestBody">
                <div className="requestTitle">
                  <h2>{item.owner_name || "بدون اسم"}</h2>
                  <strong>#{item.id}</strong>
                </div>

                <p className="requestMeta">
                  صفحة {item.page_number} — صف {Number(item.row_index) + 1} — عمود{" "}
                  {Number(item.col_index) + 1}
                </p>

                <p className="requestMeta">📍 {item.city || "لم يحدد المدينة"}</p>

                <p className="requestMeta">
                  طريقة الدفع: {getPaymentMethodLabel(item.payment_method)}
                </p>

                <p className="requestMeta">المبلغ: {Number(item.price || PRICE)} شيكل</p>

                <p className="requestDesc">{item.description || "لا يوجد وصف."}</p>

                <p className="requestDate">أُرسل في: {formatDate(item.created_at)}</p>

                {item.payment_confirmed_at && (
                  <p className="requestDate">
                    تم تأكيد الدفع: {formatDate(item.payment_confirmed_at)}
                  </p>
                )}

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

                  {item.status !== "pending_payment" && (
                    <button
                      className="pendingBtn"
                      disabled={busyId === item.id}
                      onClick={() => returnToPendingPayment(item)}
                    >
                      إرجاع للدفع
                    </button>
                  )}

                  <button
                    className="rejectBtn"
                    disabled={busyId === item.id}
                    onClick={() => rejectRequest(item)}
                  >
                    رفض وحذف
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}