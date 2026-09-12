import { Bone, CardBones, HeaderBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <HeaderBones />
      <div className="mb-10 flex items-center gap-5">
        <Bone className="h-16 w-16 rounded-full" />
        <div>
          <Bone className="h-8 w-56" />
          <Bone className="mt-3 h-3 w-40" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CardBones rows={1} />
        <CardBones rows={1} />
        <CardBones rows={1} />
      </div>
    </main>
  );
}
