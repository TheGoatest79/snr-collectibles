/* ==========================================================================
   S&R Collectibles — Supabase config
   --------------------------------------------------------------------------
   ONE-LINE ACTIVATION: when the anon (public) key arrives from the Supabase
   dashboard (Project Settings → API → "anon public"), paste it below in
   place of PASTE_ANON_KEY_HERE. Nothing else in the site needs to change.

   NEVER put the service_role key or the database password in this file.
   ========================================================================== */
window.SR_CONFIG = {
  SUPABASE_URL: "https://ktcbdifealvinawzxoqc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_4mJS0kMI_PB6eomxYpFCKQ_p3DAc2yx",
  /* S&R's own Stripe account (live). Buy buttons redirect to the product's
     Stripe Payment Link when one is set; otherwise the "coming soon" card. */
  STRIPE_PUBLISHABLE_KEY: "pk_live_51UP85tG6LJfQGZxiIMSbMSFIQt8vozlwokM0ymRw1ZJo0wsbfTS4BHRnQqztjEw946HHZQNxHiEP6cZHLdilkhgj00kXzoEhsL"
};
