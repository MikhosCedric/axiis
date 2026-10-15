import { Bone, CaptureBone, SkeletonFrame } from "@/components/page-skeleton";

/** Shown while a week loads: the heading, the capture field and seven ruled day columns, as the Week draws them. */
export default function Loading() {
  return (
    <SkeletonFrame title="w-64">
      <CaptureBone />
      <div className="@container mt-10">
        <div className="grid border-y border-rule @min-[50rem]:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 border-b border-rule px-2 pt-3 pb-3 last:border-b-0 @min-[50rem]:min-h-64 @min-[50rem]:border-b-0 @min-[50rem]:border-l @min-[50rem]:first:border-l-0"
            >
              <Bone className="h-3 w-7" />
              <Bone className="h-4 w-5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}
