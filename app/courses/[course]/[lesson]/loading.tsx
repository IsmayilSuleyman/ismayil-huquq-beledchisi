import { Bone, HeaderBones, TitleBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <HeaderBones />
      <Bone className="mb-6 h-3 w-56" />
      <div className="mx-auto max-w-3xl">
        <TitleBones />
        <div className="glass-strong mt-10 space-y-4 px-6 py-8 sm:px-10 sm:py-12">
          <Bone className="h-6 w-2/3" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-11/12" />
          <Bone className="h-3 w-4/5" />
          <Bone className="mt-6 h-3 w-full" />
          <Bone className="h-3 w-3/4" />
        </div>
      </div>
    </main>
  );
}
