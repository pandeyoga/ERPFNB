/** DailySalesForm/constants.js */
import { Tag, Receipt, Coins, Wallet, ListChecks } from "lucide-react";

const DEFAULT_CHANNELS = [
  { channel: "dine_in",  label: "Dine-in" },
  { channel: "take_away", label: "Take Away" },
  { channel: "gofood",   label: "GoFood" },
  { channel: "grabfood", label: "GrabFood" },
  { channel: "shopeefood", label: "ShopeeFood" },
  { channel: "other",    label: "Other" },
];

const DEFAULT_BUCKETS = [
  { bucket: "food", label: "Food" },
  { bucket: "beverage", label: "Beverage" },
  { bucket: "other", label: "Other" },
];

const STEPS = [
  { key: "channel", label: "Channel", icon: Tag, hint: "Breakdown gross & diskon per channel" },
  { key: "revenue", label: "Revenue", icon: Receipt, hint: "Bucket food/beverage/other untuk PL" },
  { key: "tax",     label: "Service & Tax", icon: Coins, hint: "Service charge + PB1 + transaction count" },
  { key: "payment", label: "Payment", icon: Wallet, hint: "Cash / card / e-wallet breakdown" },
  { key: "review",  label: "Review", icon: ListChecks, hint: "Cek rekonsiliasi sebelum submit" },
];

export { DEFAULT_CHANNELS, DEFAULT_BUCKETS, STEPS };
