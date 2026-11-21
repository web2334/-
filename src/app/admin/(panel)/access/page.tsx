import { AccessForm } from "@/components/admin/AccessForm";

export default function AccessPage() {
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <h1 style={{ fontSize: 28 }}>Доступ</h1>
      <AccessForm />
    </div>
  );
}
