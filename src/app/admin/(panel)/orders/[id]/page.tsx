import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/admin-orders";
import { OrderEditor } from "@/components/admin/OrderEditor";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderDetail(id);
  if (!o) notFound();
  return <OrderEditor order={JSON.parse(JSON.stringify(o))} />;
}
