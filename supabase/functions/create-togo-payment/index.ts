import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOGO_BASE_URL = "https://api.togo.ps";
const PRICE = 1;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, apiKey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function pickId(obj: any) {
  return (
    obj?.id ||
    obj?._id ||
    obj?.receiver_address_id ||
    obj?.receiverAddressId ||
    obj?.data?.id ||
    obj?.data?._id
  );
}

function pickHashedId(obj: any) {
  return (
    obj?.hashed_id ||
    obj?.hashedId ||
    obj?.hash_id ||
    obj?.order_hashed_id ||
    obj?.data?.hashed_id ||
    obj?.data?.hashedId ||
    obj?.data?.hash_id
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const TOGO_API_KEY = Deno.env.get("TOGO_API_KEY");
    const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

    if (!TOGO_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(
        {
          error: "Missing secrets",
          missing: {
            TOGO_API_KEY: !TOGO_API_KEY,
            SUPABASE_URL: !SUPABASE_URL,
            SERVICE_ROLE_KEY: !SERVICE_ROLE_KEY,
          },
        },
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();

    const {
      cellId,
      pageNumber,
      row,
      col,
      ownerName,
      city,
      description,
      imageUrl,
      buyerEmail,
      buyerPhone,
    } = body;

    if (!cellId || !pageNumber || row === undefined || col === undefined) {
      return json({ error: "بيانات المربع ناقصة" }, 400);
    }

    if (!ownerName || !imageUrl || !buyerEmail || !buyerPhone) {
      return json({ error: "الاسم والصورة والإيميل ورقم الهاتف مطلوبة" }, 400);
    }

    const { data: existingCell, error: existingError } = await supabase
      .from("pixel_cells")
      .select("id,status")
      .eq("id", cellId)
      .maybeSingle();

    if (existingError) {
      return json({ error: existingError.message }, 500);
    }

    if (existingCell) {
      return json({ error: "هذا المربع محجوز أو بانتظار الدفع" }, 409);
    }

    const { error: insertCellError } = await supabase.from("pixel_cells").insert({
      id: cellId,
      page_number: pageNumber,
      row_index: row,
      col_index: col,
      owner_name: String(ownerName).trim(),
      city: city ? String(city).trim() : null,
      description: description ? String(description).trim() : null,
      image_url: imageUrl,
      payment_method: "togo",
      status: "pending_payment",
      price: PRICE,
    });

    if (insertCellError) {
      return json({ error: insertCellError.message }, 500);
    }

    const receiverRes = await fetch(`${TOGO_BASE_URL}/api/v1/receivers-addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TOGO_API_KEY,
      },
      body: JSON.stringify({
        receiver_name: String(ownerName).trim(),
        receiver_phone_number: String(buyerPhone).trim(),
        country_code: "PS",
        country_name: "Palestine",
        phone_connected_to_whats: false,
        city: city || "Palestine",
        details: `Pixel cell #${cellId}`,
      }),
    });

    const receiverJson = await receiverRes.json();

    if (!receiverRes.ok || receiverJson?.error) {
      await supabase.from("pixel_cells").delete().eq("id", cellId);

      return json(
        {
          error: "فشل إنشاء عنوان الدفع في Togo",
          details: receiverJson,
        },
        500
      );
    }

    const receiverAddressId = pickId(receiverJson.data || receiverJson);

    if (!receiverAddressId) {
      await supabase.from("pixel_cells").delete().eq("id", cellId);

      return json(
        {
          error: "Togo لم يرجع receiver_address_id",
          details: receiverJson,
        },
        500
      );
    }

    const successUrl = `${SITE_URL}/#payment-success?cellId=${cellId}`;
    const cancelUrl = `${SITE_URL}/#payment-cancel?cellId=${cellId}`;

    const orderRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TOGO_API_KEY,
      },
      body: JSON.stringify({
        event: "Create_Visa",
        data: {
          type: "RFP",
          value: PRICE,
          receiver_address_id: receiverAddressId,
          receiver_email: String(buyerEmail).trim(),
          currency: "USD",
          source: "external_website",
          payment_success_redirect_link: successUrl,
          payment_cancel_redirect_link: cancelUrl,
          prevent_sms_link: true,
        },
      }),
    });

    const orderJson = await orderRes.json();

    if (!orderRes.ok || orderJson?.error) {
      await supabase.from("pixel_cells").delete().eq("id", cellId);

      return json(
        {
          error: "فشل إنشاء طلب الدفع في Togo",
          details: orderJson,
        },
        500
      );
    }

    const orderData = orderJson.data || {};
    const hashedId = pickHashedId(orderData) || pickHashedId(orderJson);
    const orderId = orderData.id || orderData._id || null;
    const receiverEmail = orderData.receiver_email || buyerEmail;

    if (!hashedId) {
      await supabase.from("pixel_cells").delete().eq("id", cellId);

      return json(
        {
          error: "Togo لم يرجع hashed_id",
          details: orderJson,
        },
        500
      );
    }

    const paymentUrl =
      `${TOGO_BASE_URL}/api/v1/direct-pay?orderId=${encodeURIComponent(hashedId)}` +
      `&receiverEmail=${encodeURIComponent(receiverEmail)}`;

    const { error: orderInsertError } = await supabase.from("payment_orders").insert({
      cell_id: cellId,
      provider: "togo",
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      amount: PRICE,
      currency: "USD",
      status: "created",
      togo_receiver_address_id: receiverAddressId,
      togo_order_id: orderId,
      togo_hashed_id: hashedId,
      payment_url: paymentUrl,
      raw_response: {
        receiver: receiverJson,
        order: orderJson,
      },
    });

    if (orderInsertError) {
      await supabase.from("pixel_cells").delete().eq("id", cellId);
      return json({ error: orderInsertError.message }, 500);
    }

    return json({
      success: true,
      paymentUrl,
      cellId,
    });
  } catch (error) {
    return json(
      {
        error: error?.message || "Unexpected error",
      },
      500
    );
  }
});