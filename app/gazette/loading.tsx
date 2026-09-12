import { Bone, CardBones, HeaderBones } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16">
      <HeaderBones />
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <Bone className="h-3 w-64" />
        <Bone className="mt-6 h-14 w-80 max-w-full" />
        <Bone className="mt-5 h-3 w-96 max-w-full" />
        <Bone className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="mt-14">
        <CardBones rows={4} />
      </div>
    </main>
  );
}
