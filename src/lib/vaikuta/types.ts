// VAIKUTA shared domain types.

// Delivery states follow the DB enum (uppercase). Provider adapters return the
// same values; lower-level layers never introduce a second casing.
export type CampaignDeliveryState =
  | "PENDING"
  | "QUEUED"
  | "ACCEPTED"
  | "SIMULATED_DELIVERED"
  | "FAILED";

export const DELIVERY_STATE_LABELS: Record<CampaignDeliveryState, string> = {
  PENDING: "Odottaa",
  QUEUED: "Jonossa",
  ACCEPTED: "Vastaanotettu",
  SIMULATED_DELIVERED: "Toimitettu (simuloitu)",
  FAILED: "Epäonnistui",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Luonnos",
  RECIPIENTS_SELECTED: "Vastaanottajat valittu",
  MESSAGE_READY: "Viesti valmis",
  APPROVED: "Hyväksytty",
  CHECKOUT_READY: "Kassa valmis",
  PAYMENT_COMPLETED: "Maksu simuloitu",
  DELIVERED: "Toimitettu (simuloitu)",
  CLOSED: "Suljettu",
  SUSPENDED: "Keskeytetty",
  REQUIRES_MODERATION: "Odottaa tarkistusta",
};

export const CONTACT_AVAILABILITY_LABELS: Record<string, string> = {
  verified: "Vahvistettu yhteystieto",
  public_professional: "Julkinen ammatillinen kanava",
  not_verified: "Yhteystietoa ei ole varmistettu",
};