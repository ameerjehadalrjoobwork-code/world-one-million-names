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


const LANGUAGE_STORAGE_KEY = "millionSquaresLanguage";

function getCurrentLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function getPriceText(language = getCurrentLanguage()) {
  return language === "en" ? PRICE + " NIS" : PRICE + " شيكل";
}

const TRANSLATIONS = {
  ar: {
    languageButton: "EN",
    brandTitle: "مليون مربع فلسطيني",
    brandSubtitle: "كل مربع له صاحب، صورة، قصة، ومكان ثابت على اللوحة الفلسطينية.",
    millionSquares: "المليون مربع الفلسطيني",
    counterLabel: "عدد المربعات من المليون",
    counterText: "كل مربع يتم اعتماده يضيف اسماً جديداً إلى اللوحة الفلسطينية.",
    priceLabel: "سعر المربع",
    reserveForPrice: () => "احجز مربعك بـ" + getPriceText("ar"),
    reserveShort: "حجز",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    search: "بحث",
    admin: "مدير",
    adminLogin: "دخول المدير",
    dragHint: "اسحب اللوحة بالماوس. استخدم عجلة الماوس للتكبير والتصغير.",
    goToCell: "اذهب إلى رقم مربع",
    go: "اذهب",
    cellPlaceholder: "مثلاً 12500",
    boardControls: "التحكم باللوحة",
    board: "لوحة رقم",
    boardNote: "الأرقام تصاعدية من اليمين إلى اليسار. المحجوز يظهر بدون بيانات حتى الموافقة.",
    reset: "البداية",
    pageChange: "تغيير الصفحة",
    pageNumber: "رقم الصفحة",
    pagePlaceholder: "مثلاً 2",
    goToPage: "اذهب إلى الصفحة",
    searchCell: "البحث عن مربع",
    cellNumber: "رقم المربع",
    goToSquare: "اذهب إلى المربع",
    square: "مربع",
    locationDefault: "فلسطين",
    noDescription: "لا يوجد وصف لهذا المربع بعد.",
    addedDate: "تاريخ الإضافة:",
    reserveSquare: "حجز مربع",
    uploadTitle: "ارفع صورتك واحجز مكانك",
    privacyNote: "جميع بياناتك الشخصية ستكون سرية ولن تظهر على اللوحة.",
    name: "الاسم",
    city: "المدينة",
    description: "وصف قصير",
    email: "البريد الإلكتروني للدفع",
    phone: "رقم الهاتف",
    uploadStrong: "اضغط لرفع الصورة",
    uploadHint: "JPG / PNG / WEBP",
    preparingPayment: "جاري تجهيز الدفع...",
    payButton: () => "ادفع " + getPriceText("ar") + " عبر Togo",
    paymentSuccessTitle: "تم الرجوع من صفحة الدفع",
    paymentCancelTitle: "تم إلغاء الدفع",
    paymentSuccessText: "وصل المستخدم من Togo بعد عملية الدفع. سيبقى الطلب بانتظار تأكيد الإدارة ثم الموافقة على الصورة قبل الظهور.",
    paymentCancelText: "لم تكتمل عملية الدفع. يمكن للمستخدم الرجوع للموقع والمحاولة مرة أخرى.",
    squareNumber: "رقم المربع:",
    backToBoard: "الرجوع للوحة",
  },
  en: {
    languageButton: "عربي",
    brandTitle: "One Million Palestinian Squares",
    brandSubtitle: "Each square has an owner, a photo, a story, and a permanent place on the Palestinian board.",
    millionSquares: "One million Palestinian squares",
    counterLabel: "Squares approved out of one million",
    counterText: "Every approved square adds a new name to the Palestinian board.",
    priceLabel: "Square price",
    reserveForPrice: () => "Reserve your square for " + getPriceText("en"),
    reserveShort: "Reserve",
    previous: "Previous",
    next: "Next",
    page: "Page",
    search: "Search",
    admin: "Admin",
    adminLogin: "Admin login",
    dragHint: "Drag the board with your mouse. Use the mouse wheel to zoom in and out.",
    goToCell: "Go to square number",
    go: "Go",
    cellPlaceholder: "Example 12500",
    boardControls: "Board controls",
    board: "Board",
    boardNote: "Numbers are ordered across the board. Reserved squares stay hidden until approval.",
    reset: "Reset",
    pageChange: "Change page",
    pageNumber: "Page number",
    pagePlaceholder: "Example 2",
    goToPage: "Go to page",
    searchCell: "Search for a square",
    cellNumber: "Square number",
    goToSquare: "Go to square",
    square: "Square",
    locationDefault: "Palestine",
    noDescription: "No description has been added to this square yet.",
    addedDate: "Added on:",
    reserveSquare: "Reserve square",
    uploadTitle: "Upload your photo and reserve your place",
    privacyNote: "Your personal information will remain private and will not appear on the board.",
    name: "Name",
    city: "City",
    description: "Short description",
    email: "Payment email",
    phone: "Phone number",
    uploadStrong: "Tap to upload photo",
    uploadHint: "JPG / PNG / WEBP",
    preparingPayment: "Preparing payment...",
    payButton: () => "Pay " + getPriceText("en") + " via Togo",
    paymentSuccessTitle: "Returned from payment page",
    paymentCancelTitle: "Payment cancelled",
    paymentSuccessText: "The user returned from Togo after payment. The request will wait for admin payment confirmation and photo approval before appearing.",
    paymentCancelText: "The payment was not completed. You can return to the board and try again.",
    squareNumber: "Square number:",
    backToBoard: "Back to board",
  },
};

function t(key) {
  const language = getCurrentLanguage();
  const value = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.ar[key] ?? key;
  return typeof value === "function" ? value() : value;
}

function LanguageToggle() {
  const [language, setLanguage] = useState(getCurrentLanguage());

  function toggleLanguage() {
    const nextLanguage = language === "ar" ? "en" : "ar";
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguage(nextLanguage);
    window.location.reload();
  }

  return (
    <button type="button" className="languageToggle" onClick={toggleLanguage}>
      {TRANSLATIONS[language]?.languageButton || "EN"}
    </button>
  );
}


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
      <LanguageToggle />
      <section className={`resultCard ${isSuccess ? "success" : "cancel"}`}>
        <span className="resultIcon">{isSuccess ? "✓" : "!"}</span>

        <h1>{isSuccess ? t("paymentSuccessTitle") : t("paymentCancelTitle")}</h1>

        <p>
          {isSuccess ? t("paymentSuccessText") : t("paymentCancelText")}
        </p>

        {cellId && <strong>{t("squareNumber")} #{cellId}</strong>}

        <div className="resultActions">
          <button onClick={goHome}>{t("backToBoard")}</button>
          <button onClick={goAdmin}>{t("adminLogin")}</button>
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
      <LanguageToggle />
      <div className="mobileTopCounter">
        <span>{t("millionSquares")}</span>

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
          <span>{t("reserveShort")}</span>
        </button>

        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
          <span>{t("previous")}</span>
        </button>

        <button type="button" onClick={() => setMobilePanel("page")}>
          {currentPage}
          <span>{t("page")}</span>
        </button>

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === TOTAL_PAGES}
        >
          ›
          <span>{t("next")}</span>
        </button>

        <button type="button" onClick={() => setMobilePanel("search")}>
          🔎
          <span>{t("search")}</span>
        </button>
      </div>

      <aside className="sidebar">
        <div className="brand">
          <span className="logoBox"></span>

          <div>
            <h1>{t("brandTitle")}</h1>
            <p>{t("brandSubtitle")}</p>
          </div>
        </div>

        <div className="millionProgressCard">
          <div className="progressTop">
            <span>{t("counterLabel")}</span>

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

          <p>{t("counterText")}</p>
        </div>

        <div className="priceGoldCard">
          <span>{t("priceLabel")}</span>
          <strong>{getPriceText()}</strong>
        </div>

        <button className="primaryBtn" onClick={reserveFirstEmpty}>
          {t("reserveForPrice")}
        </button>

        <div className="pageBox">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{t("previous")}</button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToPage(pageInput);
            }}
          >
            <span>{t("page")}</span>

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
          >{t("next")}</button>
        </div>

        <div className="sidebarBottomBox">
  <p>{t("dragHint")}</p>
</div>


        <form className="searchBox" onSubmit={handleSearchCell}>
  <label>{t("goToCell")}</label>

  <div>
    <button>{t("go")}</button>

    <input
      value={cellSearch}
      onChange={(e) => setCellSearch(e.target.value)}
      placeholder={t("cellPlaceholder")}
      inputMode="numeric"
    />
  </div>
</form>

<div className="desktopBoardControls">
  <label>{t("boardControls")}</label>

  <div className="desktopBoardControlsRow">
    <button type="button" onClick={() => canvasRef.current?.zoomIn?.()}>
      +
    </button>

    <span>{zoomPercent}%</span>

    <button type="button" onClick={() => canvasRef.current?.zoomOut?.()}>
      -
    </button>

    <button type="button" onClick={() => canvasRef.current?.reset?.()}>
      {t("reset")}
    </button>
  </div>
</div>

      </aside>

      <section className="boardSection">
<header className="boardHeader mobileBoardHeader">
  <div aria-hidden="true" />

  <div className="toolbar">
    <button type="button" onClick={() => canvasRef.current?.zoomIn?.()}>
      +
    </button>

    <span>{zoomPercent}%</span>

    <button type="button" onClick={() => canvasRef.current?.zoomOut?.()}>
      -
    </button>

    <button type="button" onClick={() => canvasRef.current?.reset?.()}>
      {t("reset")}
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
                <h3>{t("pageChange")}</h3>

                <form
                  className="mobileSearchForm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    goToPage(pageInput);
                  }}
                >
                  <label>{t("pageNumber")}</label>

                  <input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    inputMode="numeric"
                    placeholder={t("pagePlaceholder")}
                  />

                  <button type="submit">{t("goToPage")}</button>
                </form>
              </>
            )}

            {mobilePanel === "search" && (
              <>
                <h3>{t("searchCell")}</h3>

                <form className="mobileSearchForm" onSubmit={handleSearchCell}>
                  <label>{t("cellNumber")}</label>

                  <input
                    value={cellSearch}
                    onChange={(e) => setCellSearch(e.target.value)}
                    placeholder={t("cellPlaceholder")}
                    inputMode="numeric"
                  />

                  <button type="submit">{t("goToSquare")}</button>
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

            <span className="modalBadge">{t("square")} #{selectedCell.id}</span>

            <img className="detailsImage" src={selectedCell.imageUrl} alt="" />

            <h2>{selectedCell.ownerName}</h2>

            <p className="muted">📍 {selectedCell.city || t("locationDefault")}</p>

            <p className="description">
              {selectedCell.description || t("noDescription")}
            </p>

            <p className="dateText">{t("addedDate")} {formatDate(selectedCell.createdAt)}</p>
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

            <span className="modalBadge">{t("reserveSquare")} #{buyCell.id}</span>

            <h2>{t("uploadTitle")}</h2>
<p className="privacyNote">{t("privacyNote")}</p>
            <input
              type="text"
              placeholder={t("name")}
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
              placeholder={t("city")}
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
              placeholder={t("description")}
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
              placeholder={t("email")}
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
              placeholder={t("phone")}
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
                  <strong>{t("uploadStrong")}</strong>
                  <span>{t("uploadHint")}</span>
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
              {isSaving ? t("preparingPayment") : t("payButton")}
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


  const [manualCell, setManualCell] = useState({
    cellId: "",
    ownerName: "",
    city: "",
    description: "",
    buyerEmail: "",
    buyerPhone: "",
    imagePreviewUrl: "",
    file: null,
  });
  const [isManualSaving, setIsManualSaving] = useState(false);

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


  function updateManualCell(field, value) {
    setManualCell((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleManualImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setManualCell((prev) => ({
      ...prev,
      file,
      imagePreviewUrl: URL.createObjectURL(file),
    }));
  }

  function resetManualCellForm() {
    setManualCell({
      cellId: "",
      ownerName: "",
      city: "",
      description: "",
      buyerEmail: "",
      buyerPhone: "",
      imagePreviewUrl: "",
      file: null,
    });
  }

  async function createManualCell(e) {
    e.preventDefault();

    const cellId = Number(manualCell.cellId);

    if (!cellId || cellId < 1 || cellId > TOTAL_CELLS) {
      alert("اكتب رقم مربع صحيح من 1 إلى " + TOTAL_CELLS.toLocaleString("en-US"));
      return;
    }

    if (!manualCell.ownerName.trim()) {
      alert("اكتب الاسم");
      return;
    }

    if (!manualCell.file) {
      alert("ارفع صورة للمربع");
      return;
    }

    setIsManualSaving(true);

    try {
      const existing = await supabase
        .from("pixel_cells")
        .select("id,status")
        .eq("id", cellId)
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data) {
        const overwrite = window.confirm(
          "المربع #" + cellId + " موجود حالياً. هل تريد استبداله وإظهاره مباشرة؟"
        );

        if (!overwrite) {
          setIsManualSaving(false);
          return;
        }
      }

      const pageNumber = getPageFromCellId(cellId);
      const { row, col } = getRowColFromCellId(cellId);
      const optimizedFile = await compressImage(manualCell.file);
      const imageUrl = await uploadImageToSupabase(optimizedFile, cellId, pageNumber);

      const { error } = await supabase.from("pixel_cells").upsert(
  {
    id: cellId,
    page_number: pageNumber,
    row_index: row,
    col_index: col,
    owner_name: manualCell.ownerName.trim(),
    city: manualCell.city.trim() || null,
    description: manualCell.description.trim() || null,
    image_url: imageUrl,
    payment_method: "manual",
    status: "approved",
    payment_confirmed_at: new Date().toISOString(),
  },
  {
    onConflict: "id",
  }
);

      if (error) {
        throw error;
      }

      alert("تمت إضافة المربع #" + cellId + " وظهر مباشرة على اللوحة");
      resetManualCellForm();
      await loadAdminData(statusFilter);
      await loadCounts();
    } catch (error) {
      console.error(error);
      alert(error.message || "فشل إضافة المربع يدوياً");
    } finally {
      setIsManualSaving(false);
    }
  }


  if (!session) {
    return (
      <main className="adminLoginPage">
      <LanguageToggle />
        <form className="adminLoginCard" onSubmit={handleLogin}>
          <a className="backHome" href="#">
            الرجوع للوحة
          </a>

          <h1>{t("adminLogin")}</h1>

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
      <LanguageToggle />
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

      <section className="manualAddCard">
        <div className="manualAddHead">
          <div>
            <h2>إضافة مربع يدوياً</h2>
            <p>كمدير، تستطيع إضافة أي اسم وصورة في أي مربع وإظهاره مباشرة بدون دفع.</p>
          </div>
        </div>

        <form className="manualAddForm" onSubmit={createManualCell}>
          <label>
            رقم المربع
            <input
              value={manualCell.cellId}
              onChange={(e) => updateManualCell("cellId", e.target.value)}
              inputMode="numeric"
              placeholder="مثلاً 1948"
              disabled={isManualSaving}
            />
          </label>

          <label>
            الاسم
            <input
              value={manualCell.ownerName}
              onChange={(e) => updateManualCell("ownerName", e.target.value)}
              placeholder="اسم الشخص أو الجهة"
              disabled={isManualSaving}
            />
          </label>

          <label>
            المدينة / الدولة
            <input
              value={manualCell.city}
              onChange={(e) => updateManualCell("city", e.target.value)}
              placeholder="مثلاً نابلس أو القدس"
              disabled={isManualSaving}
            />
          </label>

          <label>
            الإيميل اختياري
            <input
              value={manualCell.buyerEmail}
              onChange={(e) => updateManualCell("buyerEmail", e.target.value)}
              placeholder="optional@email.com"
              disabled={isManualSaving}
            />
          </label>

          <label>
            الهاتف اختياري
            <input
              value={manualCell.buyerPhone}
              onChange={(e) => updateManualCell("buyerPhone", e.target.value)}
              placeholder="رقم الهاتف"
              disabled={isManualSaving}
            />
          </label>

          <label className="manualAddWide">
            وصف قصير
            <textarea
              value={manualCell.description}
              onChange={(e) => updateManualCell("description", e.target.value)}
              placeholder="وصف قصير يظهر داخل تفاصيل المربع"
              disabled={isManualSaving}
            />
          </label>

          <label className="manualImageBox">
            {manualCell.imagePreviewUrl ? (
              <img src={manualCell.imagePreviewUrl} alt="preview" />
            ) : (
              <div>
                <strong>اضغط لاختيار صورة</strong>
                <span>JPG / PNG / WEBP</span>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              hidden
              disabled={isManualSaving}
              onChange={handleManualImageUpload}
            />
          </label>

          <button type="submit" disabled={isManualSaving}>
            {isManualSaving ? "جاري الإضافة..." : "إضافة وإظهار مباشرة"}
          </button>
        </form>
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
