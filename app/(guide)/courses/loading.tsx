import { Bone, CardBones, HeaderBones, TitleBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <HeaderBones />
      <TitleBones />
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <CardBones rows={3} />
        <CardBones rows={3} />
      </div>
      <Bone className="mt-6 h-2 w-full" />
    </main>
  );
}
