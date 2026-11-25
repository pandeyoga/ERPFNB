/** ListHeader — header list inventory, berdiri sendiri (route sendiri, mis. /inventory/transfers) ATAU sebagai tab
 * di Stock Movements hub. Selalu PageHeader: di dalam hub, PageHeader otomatis mengisi subtitle & aksi header hub
 * (DESIGN_SYSTEM §10.1), jadi tidak ada judul ganda dan aksi tetap di kanan judul.
 */
import PageHeader from "@/components/shared/PageHeader";

export default function ListHeader({ icon, title, subtitle, actions }) {
  return <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} className="mb-0 md:mb-0" />;
}
