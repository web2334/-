import { listOrders, orderCounts } from "@/lib/admin-orders";
import { OrdersList } from "@/components/admin/OrdersList";

export default async function OrdersPage() {
  const [orders, counts] = await Promise.all([listOrders({ status: "active" }), orderCounts()]);
  return <OrdersList initial={JSON.parse(JSON.stringify(orders))} initialCounts={counts} />;
}
