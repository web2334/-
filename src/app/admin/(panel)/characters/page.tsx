import { getSettings } from "@/lib/settings";
import { CharactersForm } from "@/components/admin/CharactersForm";

export default async function CharactersPage() {
  const s = await getSettings();
  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <h1 style={{ fontSize: 28 }}>Персонажи</h1>
      <CharactersForm initial={s.characters} />
    </div>
  );
}
