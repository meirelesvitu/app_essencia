import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:3000";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { order_id } = await req.json();

    if (!order_id) return json({ error: "order_id é obrigatório" }, 400);

    // 1. Fetch order + items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) return json({ error: "Pedido não encontrado" }, 404);

    // Prevent creating duplicate sessions if already has one and still PENDING
    if (order.stripe_checkout_session_id && order.payment_status === "PENDING") {
      // Could return existing session, but Stripe sessions expire
      // So we allow creating a new one
    }

    if (order.payment_status === "CONFIRMED") {
      return json({ error: "Pedido já foi pago" }, 400);
    }

    const items = order.order_items || [];
    if (items.length === 0) return json({ error: "Pedido sem itens" }, 400);

    // 2. Recompute total from DB (don't trust client)
    const computedTotal = items.reduce(
      (sum: number, i: any) => sum + (i.subtotal_cents || i.unit_price_cents_snapshot * i.quantity),
      0
    );

    // 3. Create Stripe Checkout Session via API
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: "brl",
        product_data: { name: item.product_name_snapshot },
        unit_amount: item.unit_price_cents_snapshot,
      },
      quantity: item.quantity,
    }));

    const stripeBody = new URLSearchParams();
    stripeBody.append("mode", "payment");
    stripeBody.append("success_url", `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    stripeBody.append("cancel_url", `${SITE_URL}/cancel.html?order_id=${order_id}`);
    stripeBody.append("metadata[order_id]", order_id);
    stripeBody.append("metadata[order_number]", order.order_number);

    lineItems.forEach((item: any, index: number) => {
      stripeBody.append(`line_items[${index}][price_data][currency]`, "brl");
      stripeBody.append(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name);
      stripeBody.append(`line_items[${index}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      stripeBody.append(`line_items[${index}][quantity]`, String(item.quantity));
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeBody.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return json({ error: session.error?.message || "Erro ao criar sessão Stripe" }, 500);
    }

    // 4. Update order with session ID
    await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order_id);

    // 5. Create/update payment record
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", order_id)
      .single();

    if (existingPayment) {
      await supabase
        .from("payments")
        .update({ provider_ref: session.id, status: "PENDING" })
        .eq("id", existingPayment.id);
    } else {
      await supabase.from("payments").insert({
        order_id: order_id,
        provider: "STRIPE",
        provider_ref: session.id,
        status: "PENDING",
        amount_cents: computedTotal,
      });
    }

    return json({ url: session.url });
  } catch (err: any) {
    console.error("Error:", err);
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
