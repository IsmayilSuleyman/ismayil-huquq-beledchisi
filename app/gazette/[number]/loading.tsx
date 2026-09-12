import { Bone, HeaderBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      <HeaderBones />
      <Bone className="mb-6 h-3 w-40" />
      <div className="glass mb-6 p-6 sm:p-8">
        <Bone className="h-5 w-40 rounded-full" />
        <Bone className="mt-4 h-9 w-2/3" />
        <Bone className="mt-3 h-3 w-1/2" />
      </div>
      <div className="glass-strong h-[82vh] min-h-[480px]" />
    </main>
  );
}
