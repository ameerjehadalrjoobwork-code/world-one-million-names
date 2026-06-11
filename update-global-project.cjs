const fs = require("fs");
const path = require("path");

const root = process.cwd();
const appPath = path.join(root, "src", "App.jsx");
const cssPath = path.join(root, "src", "App.css");

if (!fs.existsSync(appPath) || !fs.existsSync(cssPath)) {
  console.error("شغل الملف من داخل مجلد المشروع: C:\\Users\\ameer\\palestine-million-names");
  process.exit(1);
}

let app = fs.readFileSync(appPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const edgeFunctionPath = path.join(root, "supabase", "functions", "create-togo-payment", "index.ts");
let edgeFunctionWasUpdated = false;

if (fs.existsSync(edgeFunctionPath)) {
  let edge = fs.readFileSync(edgeFunctionPath, "utf8");
  const beforeEdge = edge;

  edge = edge.replace(/const\s+(PRICE|AMOUNT|PAYMENT_AMOUNT|PAYMENT_PRICE)\s*=\s*\d+(?:\.\d+)?\s*;/g, "const $1 = 1;");
  edge = edge.replace(/(amount|price|total|value)\s*:\s*5\b/g, "$1: 1");
  edge = edge.replace(/(amount|price|total|value)\s*=\s*5\b/g, "$1 = 1");
  edge = edge.replace(/(currency|currencyCode)\s*:\s*["\'](?:ILS|NIS|SHEKEL|SHEKELS|شيكل)["\']/gi, "$1: \"USD\"");
  edge = edge.replace(/5\s*شيكل/g, "1 دولار");
  edge = edge.replace(/PRICE\s*=\s*5/g, "PRICE = 1");

  if (edge !== beforeEdge) {
    fs.writeFileSync(edgeFunctionPath, edge, "utf8");
    edgeFunctionWasUpdated = true;
  }
}

function addOnce(target, marker, addition, label) {
  if (target.includes(addition.trim().slice(0, 80))) return target;
  if (!target.includes(marker)) {
    console.warn("لم أجد مكان الإضافة: " + label);
    return target;
  }
  return target.replace(marker, marker + "\n\n" + addition);
}

function addBeforeOnce(target, marker, addition, label) {
  if (target.includes(addition.trim().slice(0, 80))) return target;
  if (!target.includes(marker)) {
    console.warn("لم أجد مكان الإضافة: " + label);
    return target;
  }
  return target.replace(marker, addition + "\n\n" + marker);
}

function replaceAllExact(target, find, replacement) {
  return target.split(find).join(replacement);
}

// 1) السعر من 5 شيكل إلى 1 دولار في الواجهة
app = app.replace(/const PRICE = \d+;/, "const PRICE = 1;");

// 2) نظام اللغة عربي/إنجليزي بدون تغيير أماكن الأزرار
const i18nBlock = `
const LANGUAGE_STORAGE_KEY = "millionSquaresLanguage";

function getCurrentLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function getPriceText(language = getCurrentLanguage()) {
  return language === "en" ? "$" + PRICE : PRICE + " دولار";
}

const TRANSLATIONS = {
  ar: {
    languageButton: "EN",
    brandTitle: "مليون مربع عالمي",
    brandSubtitle: "كل مربع له صاحب، صورة، قصة، ومكان ثابت على اللوحة.",
    millionSquares: "المليون مربع",
    counterLabel: "عدد المربعات من المليون",
    counterText: "كل مربع يتم اعتماده يضيف اسماً جديداً إلى اللوحة.",
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
    locationDefault: "العالم",
    noDescription: "لا يوجد وصف لهذا المربع بعد.",
    addedDate: "تاريخ الإضافة:",
    reserveSquare: "حجز مربع",
    uploadTitle: "ارفع صورتك واحجز مكانك",
    name: "الاسم",
    city: "المدينة / الدولة",
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
    brandTitle: "One Million Squares",
    brandSubtitle: "Each square has an owner, a photo, a story, and a permanent place on the board.",
    millionSquares: "One million squares",
    counterLabel: "Squares approved out of one million",
    counterText: "Every approved square adds a new story to the board.",
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
    locationDefault: "Worldwide",
    noDescription: "No description has been added to this square yet.",
    addedDate: "Added on:",
    reserveSquare: "Reserve square",
    uploadTitle: "Upload your photo and reserve your place",
    name: "Name",
    city: "City / Country",
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
`;
const hadI18n = app.includes("LANGUAGE_STORAGE_KEY");

if (!hadI18n) {
// 3) زر اللغة
app = app.replace(/<main className="appShell">(?!\s*<LanguageToggle \/>)/g, '<main className="appShell">\n      <LanguageToggle />');
app = app.replace(/<main className="resultPage">(?!\s*<LanguageToggle \/>)/g, '<main className="resultPage">\n      <LanguageToggle />');
app = app.replace(/<main className="adminLoginPage">(?!\s*<LanguageToggle \/>)/g, '<main className="adminLoginPage">\n      <LanguageToggle />');
app = app.replace(/<main className="adminPage">(?!\s*<LanguageToggle \/>)/g, '<main className="adminPage">\n      <LanguageToggle />');

// 4) نصوص الواجهة العامة
const replacements = [
  ['<span>المليون مربع</span>', '<span>{t("millionSquares")}</span>'],
  ['<span>حجز</span>', '<span>{t("reserveShort")}</span>'],
  ['<span>السابق</span>', '<span>{t("previous")}</span>'],
  ['<span>صفحة</span>', '<span>{t("page")}</span>'],
  ['<span>التالي</span>', '<span>{t("next")}</span>'],
  ['<span>بحث</span>', '<span>{t("search")}</span>'],
  ['<span>مدير</span>', '<span>{t("admin")}</span>'],
  ['<h1>مليون مربع فلسطيني</h1>', '<h1>{t("brandTitle")}</h1>'],
  ['<p>كل مربع له صاحب، صورة، قصة، ومكان ثابت على اللوحة.</p>', '<p>{t("brandSubtitle")}</p>'],
  ['<span>عدد المربعات من المليون</span>', '<span>{t("counterLabel")}</span>'],
  ['<p>كل مربع يتم اعتماده يضيف اسماً جديداً إلى اللوحة.</p>', '<p>{t("counterText")}</p>'],
  ['<span>سعر المربع</span>', '<span>{t("priceLabel")}</span>'],
  ['<strong>{PRICE} شيكل</strong>', '<strong>{getPriceText()}</strong>'],
  ['احجز أول مربع فارغ', '{t("reserveForPrice")}'],
  ['دخول المدير', '{t("adminLogin")}'],
  ['اسحب اللوحة بالماوس. استخدم عجلة الماوس للتكبير والتصغير.', '{t("dragHint")}'],
  ['<label>اذهب إلى رقم مربع</label>', '<label>{t("goToCell")}</label>'],
  ['<button>اذهب</button>', '<button>{t("go")}</button>'],
  ['placeholder="مثلاً 12500"', 'placeholder={t("cellPlaceholder")}'],
  ['<label>التحكم باللوحة</label>', '<label>{t("boardControls")}</label>'],
  ['<span>الصفحة</span>', '<span>{t("page")}</span>'],
  ['<h2>لوحة رقم {currentPage}</h2>', '<h2>{t("board")} {currentPage}</h2>'],
  ['الأرقام تصاعدية من اليمين إلى اليسار. المحجوز يظهر بدون بيانات حتى الموافقة.', '{t("boardNote")}'],
  ['البداية', '{t("reset")}'],
  ['<h3>تغيير الصفحة</h3>', '<h3>{t("pageChange")}</h3>'],
  ['<label>رقم الصفحة</label>', '<label>{t("pageNumber")}</label>'],
  ['placeholder="مثلاً 2"', 'placeholder={t("pagePlaceholder")}'],
  ['اذهب إلى الصفحة', '{t("goToPage")}'],
  ['<h3>البحث عن مربع</h3>', '<h3>{t("searchCell")}</h3>'],
  ['<label>رقم المربع</label>', '<label>{t("cellNumber")}</label>'],
  ['اذهب إلى المربع', '{t("goToSquare")}'],
  ['مربع #{selectedCell.id}', '{t("square")} #{selectedCell.id}'],
  ['📍 {selectedCell.city || "فلسطين"}', '📍 {selectedCell.city || t("locationDefault")}'],
  ['لا يوجد وصف لهذا المربع بعد.', '{t("noDescription")}'],
  ['تاريخ الإضافة: {formatDate(selectedCell.createdAt)}', '{t("addedDate")} {formatDate(selectedCell.createdAt)}'],
  ['حجز مربع #{buyCell.id}', '{t("reserveSquare")} #{buyCell.id}'],
  ['<h2>ارفع صورتك واحجز مكانك</h2>', '<h2>{t("uploadTitle")}</h2>'],
  ['placeholder="الاسم"', 'placeholder={t("name")}'],
  ['placeholder="المدينة"', 'placeholder={t("city")}'],
  ['placeholder="وصف قصير"', 'placeholder={t("description")}'],
  ['placeholder="البريد الإلكتروني للدفع"', 'placeholder={t("email")}'],
  ['placeholder="رقم الهاتف"', 'placeholder={t("phone")}'],
  ['<strong>اضغط لرفع الصورة</strong>', '<strong>{t("uploadStrong")}</strong>'],
  ['<span>JPG / PNG / WEBP</span>', '<span>{t("uploadHint")}</span>'],
];
for (const [find, replacement] of replacements) {
  app = replaceAllExact(app, find, replacement);
}

app = app.replace(/>\s*السابق\s*</g, ">{t(\"previous\")}<");
app = app.replace(/>\s*التالي\s*</g, ">{t(\"next\")}<");

app = app.replace(/\{isSaving \? "جاري تجهيز الدفع\.\.\." : `ادفع \$\{PRICE\} شيكل عبر Togo`\}/g, '{isSaving ? t("preparingPayment") : t("payButton")}');
app = app.replace(/<h1>\{isSuccess \? "تم الرجوع من صفحة الدفع" : "تم إلغاء الدفع"\}<\/h1>/g, '<h1>{isSuccess ? t("paymentSuccessTitle") : t("paymentCancelTitle")}</h1>');
app = app.replace(/\{isSuccess\s*\?\s*"وصل المستخدم من Togo بعد عملية الدفع\. سيبقى الطلب بانتظار تأكيد الإدارة ثم الموافقة على الصورة قبل الظهور\."\s*:\s*"لم تكتمل عملية الدفع\. يمكن للمستخدم الرجوع للموقع والمحاولة مرة أخرى\."\}/g, '{isSuccess ? t("paymentSuccessText") : t("paymentCancelText")}');
app = app.replace(/<strong>رقم المربع: #\{cellId\}<\/strong>/g, '<strong>{t("squareNumber")} #{cellId}</strong>');
app = app.replace(/<button onClick=\{goHome\}>الرجوع للوحة<\/button>/g, '<button onClick={goHome}>{t("backToBoard")}</button>');
app = app.replace(/<button onClick=\{goAdmin\}>\{t\("adminLogin"\)\}<\/button>/g, '<button onClick={goAdmin}>{t("adminLogin")}</button>');

app = addOnce(app, 'const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";', i18nBlock, "language/i18n block");
}

// 5) إضافة مربع يدوياً من لوحة المدير
const manualState = `
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
  const [isManualSaving, setIsManualSaving] = useState(false);`;
app = addOnce(app, "  const [busyId, setBusyId] = useState(null);", manualState, "manual admin state");

const manualFunctions = `
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
          row,
          col,
          owner_name: manualCell.ownerName.trim(),
          city: manualCell.city.trim(),
          description: manualCell.description.trim(),
          image_url: imageUrl,
          buyer_email: manualCell.buyerEmail.trim(),
          buyer_phone: manualCell.buyerPhone.trim(),
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
`;
app = addBeforeOnce(app, "  if (!session) {", manualFunctions, "manual admin functions");

const manualAdminCard = `      <section className="manualAddCard">
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
              placeholder="مثلاً London أو Nablus"
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
`;
app = addBeforeOnce(app, "      <section className=\"adminControls\">", manualAdminCard, "manual admin card");

// 6) CSS إضافي فقط
const cssAddition = `

/* =========================================================
   Global language + admin manual add
   هذه الإضافات لا تغيّر أماكن أزرار الجوال أو الكمبيوتر
========================================================= */

.languageToggle {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 500;
  height: 38px;
  min-width: 56px;
  border: 0;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  font-size: 13px;
  font-weight: 950;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}

.manualAddCard {
  display: grid;
  gap: 14px;
  margin-bottom: 16px;
  padding: 18px;
  border-radius: 26px;
  background: #ffffff;
  border: 1px solid #e7dfd3;
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.08);
}

.manualAddHead h2 {
  margin: 0 0 4px;
  color: #111827;
  font-size: 24px;
  font-weight: 950;
}

.manualAddHead p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 750;
  line-height: 1.7;
}

.manualAddForm {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  align-items: end;
}

.manualAddForm label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-size: 13px;
  font-weight: 900;
}

.manualAddForm input,
.manualAddForm textarea {
  width: 100%;
  border: 1px solid #ded8cf;
  background: #ffffff;
  color: #111827;
  border-radius: 16px;
  padding: 11px 12px;
  font-size: 14px;
  font-weight: 750;
  outline: none;
}

.manualAddForm textarea {
  min-height: 74px;
  resize: vertical;
}

.manualAddWide {
  grid-column: span 2;
}

.manualImageBox {
  min-height: 94px;
  display: grid !important;
  place-items: center;
  overflow: hidden;
  border-radius: 18px;
  border: 2px dashed #c9bfb0;
  background: #faf7f2;
  text-align: center;
  cursor: pointer;
}

.manualImageBox div {
  display: grid;
  gap: 4px;
}

.manualImageBox strong {
  font-size: 13px;
  color: #334155;
}

.manualImageBox span {
  font-size: 11px;
  color: #64748b;
}

.manualImageBox img {
  width: 100%;
  height: 100%;
  min-height: 94px;
  object-fit: cover;
}

.manualAddForm button {
  height: 48px;
  border: 0;
  border-radius: 16px;
  background: #00d084;
  color: #04130d;
  font-size: 14px;
  font-weight: 950;
}

@media (max-width: 900px) {
  .manualAddForm {
    grid-template-columns: 1fr;
  }

  .manualAddWide {
    grid-column: auto;
  }
}

@media (max-width: 768px) and (hover: none) and (pointer: coarse) {
  .languageToggle {
    top: 12px;
    left: 12px;
    height: 30px;
    min-width: 44px;
    font-size: 11px;
    z-index: 600;
  }
}
`;
if (!css.includes("Global language + admin manual add")) {
  css += cssAddition;
}

fs.writeFileSync(appPath, app, "utf8");
fs.writeFileSync(cssPath, css, "utf8");

console.log("تم تحديث App.jsx و App.css بنجاح.");
if (edgeFunctionWasUpdated) {
  console.log("تم تحديث create-togo-payment/index.ts بشكل مبدئي إلى 1 دولار. تأكد من حقول Togo ثم اعمل deploy للـ function.");
} else {
  console.log("مهم: لم أستطع تعديل مبلغ Edge Function تلقائياً. راجع supabase/functions/create-togo-payment/index.ts واجعل المبلغ 1 والعملة USD ثم deploy.");
}
