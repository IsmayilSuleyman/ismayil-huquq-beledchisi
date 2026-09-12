import { Bone, CardBones, HeaderBones, TitleBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <HeaderBones />
      <Bone className="mb-6 h-3 w-40" />
      <TitleBones />
      <div className="mt-12">
        <Bone className="mb-6 h-2 w-full" />
        <CardBones rows={4} />
      </div>
    </main>
  );
}
